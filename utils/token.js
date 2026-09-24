const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
    },
    process.env.JWT_ACCESS_SECRET,
    // {
    //   expiresIn: process.env.JWT_ACCESS_EXPIRES || "1d",
    //   issuer: "secure-api",
    //   audience: "secure-client",
    // }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES || "7d",
      issuer: "secure-api",
      audience: "secure-client",
    }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};