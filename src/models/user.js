/**
 * Lớp đại diện cho cấu trúc dữ liệu người dùng (User Schema).
 * Chỉ định nghĩa các trường thông tin, kiểm tra tính hợp lệ dữ liệu và định dạng đầu ra.
 */
class User {
  constructor({ id, email, password, displayName, createdAt, updatedAt }) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.displayName = displayName || "";
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  /**
   * Kiểm tra tính hợp lệ đơn giản cho Schema của User.
   * @param {Object} data - Dữ liệu đầu vào cần kiểm tra.
   */
  static validate(data) {
    if (!data.email) {
      throw new Error("Email là bắt buộc.");
    }
    if (data.email && !data.email.includes("@")) {
      throw new Error("Email không hợp lệ.");
    }
    if (!data.password) {
      throw new Error("Mật khẩu là bắt buộc.");
    }
    if (data.password && data.password.length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    }
  }

  /**
   * Chuyển đổi đối tượng User thành dữ liệu thuần túy để lưu trữ trong Firestore.
   * @returns {Object}
   */
  toFirestore() {
    return {
      email: this.email,
      password: this.password,
      displayName: this.displayName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Định dạng dữ liệu phản hồi trả về client (loại bỏ mật khẩu).
   * @returns {Object}
   */
  toResponse() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

module.exports = User;
