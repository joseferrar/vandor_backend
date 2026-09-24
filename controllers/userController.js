const User = require("../models/User");

/**
 * @route   GET /api/users
 * @desc    Get paginated users with optional role & organization filters
 * @access  Private (Super Admin)
 */
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, organizationId, search } = req.query;
    const filter = {};

    if (role && role !== "ALL") {
      filter.role = role;
    }
    if (organizationId && organizationId !== "ALL") {
      filter.organizationId = organizationId;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalUsers = await User.countDocuments(filter);
    const users = await User.find(filter)
      .populate("organizationId", "name code")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   POST /api/users
 * @desc    Create a user (Admin or Vendor)
 * @access  Private (Super Admin)
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, organizationId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: cleanEmail });
    if (exists) {
      return res.status(400).json({ success: false, message: "User email already exists." });
    }

    const newUser = new User({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: role || "admin",
      organizationId: organizationId || null,
      isActive: true,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      data: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        organizationId: newUser.organizationId,
        status: "Active",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Toggle user status (Active / Inactive)
 * @access  Private (Super Admin)
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User status changed to ${user.isActive ? "Active" : "Inactive"}.`,
      data: {
        id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
