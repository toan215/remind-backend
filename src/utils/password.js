const bcrypt = require("bcryptjs");

/**
 * Mã hóa mật khẩu (băm mật khẩu).
 * @param {string} password - Mật khẩu dạng thô.
 * @returns {Promise<string>} - Mật khẩu đã được mã hóa.
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

/**
 * Xác thực mật khẩu (so khớp mật khẩu thô và mật khẩu đã mã hóa).
 * @param {string} plainPassword - Mật khẩu dạng thô.
 * @param {string} hashedPassword - Mật khẩu đã mã hóa từ DB.
 * @returns {Promise<boolean>}
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword,
};
