const mongoose = require("mongoose");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

/**
 * Standalone MongoDB accepts startTransaction() and only fails on the first
 * write ("Transaction numbers are only allowed on a replica set member or mongos").
 * Cache the deployment check so later requests skip the transaction path.
 */
let transactionsSupported;

function transactionUnsupported(error) {
  const sources = [error, error?.originalError, error?.errorResponse];
  return sources.some((item) => {
    if (!item) return false;
    if (item.code === 20) return true;
    const message = item.message || item.errmsg || "";
    return /transaction numbers are only allowed/i.test(message)
      || /does not support retryable writes/i.test(message);
  });
}

async function deploymentSupportsTransactions() {
  if (transactionsSupported !== undefined) return transactionsSupported;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

async function endSessionQuietly(session) {
  if (!session || session.hasEnded) return;
  try {
    if (session.inTransaction()) await session.abortTransaction();
  } catch (_) {}
  try {
    await session.endSession();
  } catch (_) {}
}

/**
 * Helper to run an atomic operation with MongoDB transactions if supported,
 * otherwise with graceful fallback for standalone local DBs.
 */
async function runAtomic(fn) {
  if (!(await deploymentSupportsTransactions())) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await endSessionQuietly(session);
    if (!transactionUnsupported(error)) throw error;
    transactionsSupported = false;
    return fn(null);
  } finally {
    if (session && !session.hasEnded) {
      try {
        await session.endSession();
      } catch (_) {}
    }
  }
}

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations with admin and vendor stats
 * @access  Private (Super Admin)
 */
exports.getOrganizations = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const orgs = await Organization.find(filter)
      .populate("admin", "name email role status isActive isSuspend")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Organization.countDocuments(filter);

    // Calculate vendor count for each organization
    const orgsWithCounts = await Promise.all(
      orgs.map(async (org) => {
        const vendorCount = await Vendor.countDocuments({ organizationId: org._id });
        return {
          id: org._id.toString(),
          name: org.name,
          code: org.code,
          description: org.description,
          website: org.website,
          logo: org.logo,
          adminId: org.adminId ? org.adminId.toString() : "",
          adminName: org.admin ? org.admin.name : "Unassigned",
          adminEmail: org.admin ? org.admin.email : "",
          status: org.status,
          vendorCount,
          createdAt: org.createdAt.toISOString(),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: orgsWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get organizations error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/organizations
 * @desc    Atomic creation of Organization and its single designated Admin
 * @access  Private (Super Admin)
 */
exports.createOrganization = async (req, res) => {
  try {
    const { name, code, description, website, adminName, adminEmail, adminPassword } = req.body;

    if (!name || !code || !adminName || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: "Organization name, code, adminName, and adminEmail are required.",
      });
    }

    // Sanitize or auto-generate code if empty
    let cleanCode = (code || name)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");

    const cleanEmail = adminEmail.trim().toLowerCase();

    // Check code uniqueness and auto-increment if needed
    let codeExists = await Organization.findOne({ code: cleanCode });
    if (codeExists) {
      // If code was explicitly passed and already exists, generate a unique suffix or inform
      let counter = 2;
      let candidate = `${cleanCode}_${counter}`;
      while (await Organization.findOne({ code: candidate })) {
        counter++;
        candidate = `${cleanCode}_${counter}`;
      }
      cleanCode = candidate;
    }

    // Check user email uniqueness
    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: `User with email "${cleanEmail}" already exists.`,
      });
    }

    const result = await runAtomic(async (session) => {
      // 1. Create Admin user
      const userOptions = session ? { session } : {};
      const newAdmin = new User({
        name: adminName.trim(),
        email: cleanEmail,
        password: adminPassword || "Admin@1234",
        role: "admin",
        organizationId: null, // assigned right after org creation
        isActive: true,
      });
      await newAdmin.save(userOptions);

      // 2. Create Organization with adminId linked
      const newOrg = new Organization({
        name: name.trim(),
        code: cleanCode,
        description: description ? description.trim() : "",
        website: website ? website.trim() : "",
        adminId: newAdmin._id,
        status: "Active",
      });
      await newOrg.save(userOptions);

      // 3. Link back organizationId to Admin user
      newAdmin.organizationId = newOrg._id;
      await newAdmin.save(userOptions);

      return { org: newOrg, admin: newAdmin };
    });

    return res.status(201).json({
      success: true,
      message: "Organization and designated Admin created successfully.",
      data: {
        organization: {
          id: result.org._id.toString(),
          name: result.org.name,
          code: result.org.code,
          description: result.org.description,
          website: result.org.website,
          adminId: result.admin._id.toString(),
          adminName: result.admin.name,
          adminEmail: result.admin.email,
          status: result.org.status,
          vendorCount: 0,
          createdAt: result.org.createdAt.toISOString(),
        },
        admin: {
          id: result.admin._id.toString(),
          name: result.admin.name,
          email: result.admin.email,
          role: result.admin.role,
          organizationId: result.org._id.toString(),
          status: "Active",
        },
      },
    });
  } catch (error) {
    console.error("Create organization error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/organizations/:id/reassign-admin
 * @desc    Super Admin replaces the single designated Admin of an Organization
 * @access  Private (Super Admin)
 */
exports.reassignAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminName, adminEmail, adminPassword } = req.body;

    if (!adminName || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: "adminName and adminEmail are required.",
      });
    }

    const org = await Organization.findById(id);
    if (!org) {
      return res.status(404).json({ success: false, message: "Organization not found." });
    }

    const cleanEmail = adminEmail.trim().toLowerCase();

    const result = await runAtomic(async (session) => {
      const opts = session ? { session } : {};

      // 1. Unlink previous admin
      if (org.adminId) {
        await User.findByIdAndUpdate(
          org.adminId,
          { organizationId: null, isActive: false },
          opts
        );
      }

      // 2. Check if new admin exists or create fresh
      let newAdmin = await User.findOne({ email: cleanEmail }).session(session || null);
      if (!newAdmin) {
        newAdmin = new User({
          name: adminName.trim(),
          email: cleanEmail,
          password: adminPassword || "Admin@1234",
          role: "admin",
          organizationId: org._id,
          isActive: true,
        });
        await newAdmin.save(opts);
      } else {
        newAdmin.name = adminName.trim();
        newAdmin.role = "admin";
        newAdmin.organizationId = org._id;
        newAdmin.isActive = true;
        if (adminPassword) {
          newAdmin.password = adminPassword;
        }
        await newAdmin.save(opts);
      }

      // 3. Update Org adminId
      org.adminId = newAdmin._id;
      await org.save(opts);

      return { org, admin: newAdmin };
    });

    return res.status(200).json({
      success: true,
      message: "Organization admin reassigned successfully.",
      data: {
        organizationId: result.org._id.toString(),
        adminId: result.admin._id.toString(),
        adminName: result.admin.name,
        adminEmail: result.admin.email,
      },
    });
  } catch (error) {
    console.error("Reassign admin error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   GET /api/organizations/:id
 * @desc    Get single organization details
 * @access  Private (Super Admin)
 */
exports.getOrganizationById = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).populate("admin", "name email role status");
    if (!org) {
      return res.status(404).json({ success: false, message: "Organization not found." });
    }

    const vendorCount = await Vendor.countDocuments({ organizationId: org._id });

    return res.status(200).json({
      success: true,
      data: {
        id: org._id.toString(),
        name: org.name,
        code: org.code,
        description: org.description,
        website: org.website,
        adminId: org.adminId?.toString() || "",
        adminName: org.admin?.name || "Unassigned",
        adminEmail: org.admin?.email || "",
        status: org.status,
        vendorCount,
        createdAt: org.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PUT /api/organizations/:id
 * @desc    Update organization info
 * @access  Private (Super Admin)
 */
exports.updateOrganization = async (req, res) => {
  try {
    const { name, code, description, website, status } = req.body;
    const org = await Organization.findById(req.params.id);

    if (!org) {
      return res.status(404).json({ success: false, message: "Organization not found." });
    }

    if (name) org.name = name.trim();
    if (code) org.code = code.trim().toUpperCase();
    if (description !== undefined) org.description = description.trim();
    if (website !== undefined) org.website = website.trim();
    if (status) org.status = status;

    await org.save();

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      data: org,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   DELETE /api/organizations/:id
 * @desc    Deletes an organization and handles cascading deactivation
 * @access  Private (Super Admin)
 */
exports.deleteOrganization = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ success: false, message: "Organization not found." });
    }

    await runAtomic(async (session) => {
      const opts = session ? { session } : {};
      // Deactivate Admin
      if (org.adminId) {
        await User.findByIdAndUpdate(org.adminId, { isActive: false }, opts);
      }
      // Deactivate Vendors
      await Vendor.updateMany({ organizationId: org._id }, { status: "Inactive" }, opts);
      // Delete Organization
      await Organization.findByIdAndDelete(org._id, opts);
    });

    return res.status(200).json({
      success: true,
      message: "Organization and dependencies removed successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
