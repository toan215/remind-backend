const UserService = require("../services/userService");
const { generateToken } = require("../utils/jwt");

/**
 * Đăng ký tài khoản người dùng mới (Register User).
 */
exports.register = async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const user = await UserService.registerUser({ email, password, displayName });
    
    // Tạo JWT token cho phiên đăng nhập mới
    const token = generateToken(user._id, user.email);

    return res.status(201).json({
      message: "Đăng ký tài khoản thành công.",
      user: user.toResponse(),
      token,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Đăng nhập người dùng (Login User).
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserService.loginUser(email, password);

    // Tạo JWT token sau khi xác thực thành công
    const token = generateToken(user._id, user.email);

    return res.status(200).json({
      message: "Đăng nhập thành công.",
      user: user.toResponse(),
      token,
    });
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
};

/**
 * Lấy chi tiết thông tin một người dùng (Get User Profile).
 */
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserService.getUserById(id);
    
    return res.status(200).json(user.toResponse());
  } catch (error) {
    const statusCode = error.message === "Không tìm thấy người dùng." ? 404 : 500;
    return res.status(statusCode).json({ error: error.message });
  }
};

/**
 * Cập nhật thông tin người dùng (Update User).
 */
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, password } = req.body;

    const user = await UserService.updateUser(id, { displayName, password });
    
    return res.status(200).json({
      message: "Cập nhật thông tin thành công.",
      user: user.toResponse(),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Xóa người dùng (Delete User).
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await UserService.deleteUser(id);
    
    return res.status(200).json({ message: "Xóa người dùng thành công." });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
