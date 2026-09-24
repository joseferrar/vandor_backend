const User = require("../models/User");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");

/**
 * @route   POST /api/auth/login
 * @desc    Authenticates a user and issues tokens
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive || user.isSuspend) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated or suspended.",
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Optionally set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      accessToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId ? user.organizationId.toString() : null,
        status: user.isActive && !user.isSuspend ? "Active" : "Inactive",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged in user session
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("organizationId", "name code logo status");

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId?._id ? user.organizationId._id.toString() : user.organizationId,
          organization: user.organizationId,
          status: user.isActive && !user.isSuspend ? "Active" : "Inactive",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user session.",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Clear cookies / logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  res.clearCookie("refreshToken");
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};
