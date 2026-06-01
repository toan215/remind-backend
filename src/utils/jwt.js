const jwt = require("jsonwebtoken");

/**
 * Tạo JSON Web Token (JWT) cho người dùng.
 * @param {string} userId - ID người dùng.
 * @param {string} email - Email người dùng.
 * @returns {string} - Token đã ký.
 */
const generateToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

module.exports = { generateToken };
