const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Đăng ký tài khoản mới
router.post("/register", userController.register);

// Đăng nhập
router.post("/login", userController.login);

// Lấy thông tin user bằng ID
router.get("/:id", userController.getUserProfile);

// Cập nhật thông tin user
router.put("/:id", userController.updateUserProfile);

// Xóa user
router.delete("/:id", userController.deleteUser);

module.exports = router;
