const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email là bắt buộc."],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ."],
    },
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc."],
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự."],
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, // Tự động quản lý createdAt và updatedAt
  }
);

/**
 * Kiểm tra tính hợp lệ dữ liệu đầu vào (tương thích ngược với logic cũ).
 * @param {Object} data - Dữ liệu đầu vào cần kiểm tra.
 */
userSchema.statics.validate = function (data) {
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
};

/**
 * Định dạng dữ liệu phản hồi trả về client (loại bỏ mật khẩu và format id).
 * @returns {Object}
 */
userSchema.methods.toResponse = function () {
  const userObject = this.toObject();
  userObject.id = userObject._id.toString();
  delete userObject._id;
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
