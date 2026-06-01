const jwt = require("jsonwebtoken");

/**
 * Middleware xác thực người dùng bằng JSON Web Token (JWT)
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Không tìm thấy token xác thực. Truy cập bị từ chối.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Xác thực token được gửi từ client sử dụng JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Đính kèm thông tin user được giải mã vào request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Xác thực token thất bại:", error.message);
    return res.status(403).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn.",
    });
  }
};

module.exports = verifyToken;
