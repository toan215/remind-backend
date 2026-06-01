const User = require("../models/user");
const { hashPassword, comparePassword } = require("../utils/password");

class UserService {
  /**
   * Tạo tài khoản người dùng mới.
   * @param {Object} userData - Dữ liệu thô từ request body (email, password, displayName).
   * @returns {Promise<User>} - Đối tượng User được tạo từ MongoDB.
   */
  static async registerUser(userData) {
    // 1. Kiểm tra tính hợp lệ của Schema dữ liệu đầu vào
    User.validate(userData);

    const { email, password, displayName } = userData;

    // 2. Kiểm tra trùng lặp email trong MongoDB
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("Email đã được đăng ký.");
    }

    // 3. Mã hóa mật khẩu thông qua helper utils/password.js
    const hashedPassword = await hashPassword(password);

    // 4. Tạo và lưu thực thể User vào MongoDB
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      displayName,
    });

    return newUser;
  }

  /**
   * Đăng nhập và xác thực người dùng.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<User>}
   */
  static async loginUser(email, password) {
    if (!email || !password) {
      throw new Error("Email và mật khẩu là bắt buộc.");
    }

    // 1. Tìm thông tin user dựa trên email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }

    // 2. So khớp mật khẩu đã được mã hóa thông qua helper
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }

    return user;
  }

  /**
   * Lấy thông tin người dùng bằng ID.
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng.");
    }
    return user;
  }

  /**
   * Cập nhật thông tin người dùng.
   * @param {string} userId
   * @param {Object} updateData - Các thông tin muốn thay đổi.
   * @returns {Promise<User>}
   */
  static async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại.");
    }

    if (updateData.displayName !== undefined) {
      user.displayName = updateData.displayName;
    }

    // Nếu có đổi mật khẩu, tiến hành mã hóa mật khẩu mới
    if (updateData.password) {
      if (updateData.password.length < 6) {
        throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      }
      user.password = await hashPassword(updateData.password);
    }

    user.updatedAt = new Date();

    // Lưu lại thay đổi vào MongoDB
    await user.save();
    return user;
  }

  /**
   * Xóa người dùng khỏi MongoDB.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async deleteUser(userId) {
    const result = await User.findByIdAndDelete(userId);
    if (!result) {
      throw new Error("Người dùng không tồn tại.");
    }
    return true;
  }
}

module.exports = UserService;
