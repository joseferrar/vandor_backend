const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");

/**
 * Standalone MongoDB rejects retryable writes (error code 20).
 * The driver defaults this on, so force it off before every vendor write.
 */
function disableRetryableWrites() {
  const client = mongoose.connection.getClient?.();
  if (client?.s?.options) {
    client.s.options.retryWrites = false;
  }
}

/**
 * @route   GET /api/vendors
 * @desc    Get vendors scoped strictly by tenant (or all for Super Admin)
 * @access  Private (Admin, Super Admin)
 */
exports.getVendors = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    // req.tenantFilter is enforced by tenantMiddleware
    const filter = { ...req.tenantFilter };

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const vendors = await Vendor.find(filter)
      .populate("organizationId", "name code")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Vendor.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: vendors.map((v) => ({
        id: v._id.toString(),
        organizationId: v.organizationId?._id ? v.organizationId._id.toString() : v.organizationId?.toString(),
        organizationName: v.organizationId?.name || "",
        type: v.type,
        name: v.name,
        email: v.email,
        phone: v.phone,
        address: v.address,
        paymentDetails: v.paymentDetails,
        documentVerification: v.documentVerification,
        capability: v.capability,
        capabilityStartDate: v.capabilityStartDate,
        capabilityEndDate: v.capabilityEndDate,
        status: v.status,
        createdAt: v.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get vendors error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/vendors
 * @desc    Create / Onboard a vendor
 * @access  Private (Admin, Super Admin)
 */
exports.createVendor = async (req, res) => {
  try {
    const {
      organizationId,
      type,
      name,
      email,
      phone,
      address,
      paymentDetails,
      documentVerification,
      capability,
      capabilityStartDate,
      capabilityEndDate,
      status,
    } = req.body;

    // organizationId is already verified or injected by tenantMiddleware
    if (!name || !email || !phone || !organizationId) {
      return res.status(400).json({
        success: false,
        message: "Vendor name, email, phone, and organizationId are required.",
      });
    }

    if (!/^[a-fA-F0-9]{24}$/.test(String(organizationId))) {
      return res.status(400).json({
        success: false,
        message: "organizationId must be a valid MongoDB id from an existing organization.",
      });
    }

    disableRetryableWrites();

    const vendor = new Vendor({
      organizationId,
      type: type || "Organization",
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address || "N/A",
      paymentDetails: paymentDetails || {
        bankName: "N/A",
        accNo: "N/A",
        ifsc: "N/A",
        bankAddress: "N/A",
        panNo: "N/A",
      },
      documentVerification: documentVerification || { pan: "N/A" },
      capability: capability || ["Referral"],
      capabilityStartDate: capabilityStartDate || new Date(),
      capabilityEndDate: capabilityEndDate || null,
      status: status || "Active",
    });

    await vendor.save();

    return res.status(201).json({
      success: true,
      message: "Vendor onboarded successfully.",
      data: {
        id: vendor._id.toString(),
        organizationId: vendor.organizationId.toString(),
        name: vendor.name,
        email: vendor.email,
        status: vendor.status,
        createdAt: vendor.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Create vendor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   GET /api/vendors/:id
 * @desc    Get single vendor by ID (scoped)
 * @access  Private (Admin, Super Admin)
 */
exports.getVendorById = async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...req.tenantFilter };
    const vendor = await Vendor.findOne(filter).populate("organizationId", "name code");

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found." });
    }

    return res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PUT /api/vendors/:id
 * @desc    Update vendor profile
 * @access  Private (Admin, Super Admin)
 */
exports.updateVendor = async (req, res) => {
  try {
    disableRetryableWrites();
    const filter = { _id: req.params.id, ...req.tenantFilter };
    const vendor = await Vendor.findOne(filter);

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found or access denied." });
    }

    const {
      name,
      email,
      phone,
      address,
      paymentDetails,
      documentVerification,
      capability,
      capabilityStartDate,
      capabilityEndDate,
      status,
    } = req.body;

    if (name) vendor.name = name.trim();
    if (email) vendor.email = email.trim().toLowerCase();
    if (phone) vendor.phone = phone.trim();
    if (address) vendor.address = address.trim();
    if (paymentDetails) vendor.paymentDetails = { ...vendor.paymentDetails, ...paymentDetails };
    if (documentVerification) vendor.documentVerification = { ...vendor.documentVerification, ...documentVerification };
    if (capability) vendor.capability = capability;
    if (capabilityStartDate) vendor.capabilityStartDate = capabilityStartDate;
    if (capabilityEndDate) vendor.capabilityEndDate = capabilityEndDate;
    if (status) vendor.status = status;

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully.",
      data: vendor,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   DELETE /api/vendors/:id
 * @desc    Delete vendor (scoped to tenant)
 * @access  Private (Admin, Super Admin)
 */
exports.deleteVendor = async (req, res) => {
  try {
    disableRetryableWrites();
    const filter = { _id: req.params.id, ...req.tenantFilter };
    const deleted = await Vendor.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Vendor not found or access denied." });
    }

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PATCH /api/vendors/:id/status
 * @desc    Update vendor status (Active / Inactive)
 * @access  Private (Admin, Super Admin)
 */
exports.updateVendorStatus = async (req, res) => {
  try {
    disableRetryableWrites();
    const { status } = req.body;
    const filter = { _id: req.params.id, ...req.tenantFilter };

    const vendor = await Vendor.findOne(filter);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found or access denied." });
    }

    vendor.status = status || (vendor.status === "Active" ? "Inactive" : "Active");
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: `Vendor status updated to ${vendor.status}.`,
      data: vendor,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
