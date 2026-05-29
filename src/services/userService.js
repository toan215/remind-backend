const { db } = require("../configs/firebase");
const User = require("../models/user");
const { hashPassword, comparePassword } = require("../utils/password");

const COLLECTION_NAME = "users";

class UserService {
  /**
   * Tạo tài khoản người dùng mới.
   * @param {Object} userData - Dữ liệu thô từ request body (email, password, displayName).
   * @returns {Promise<User>} - Đối tượng User được tạo.
   */
  static async registerUser(userData) {
    // 1. Kiểm tra tính hợp lệ của Schema dữ liệu
    User.validate(userData);

    const { email, password, displayName } = userData;

    // 2. Kiểm tra trùng lặp email trong Firestore
    const userSnapshot = await db
      .collection(COLLECTION_NAME)
      .where("email", "==", email)
      .limit(1)
      .get();
      
    if (!userSnapshot.empty) {
      throw new Error("Email đã được đăng ký.");
    }

    // 3. Mã hóa mật khẩu thông qua helper utils/hash.js
    const hashedPassword = await hashPassword(password);

    // 4. Tạo thực thể User dựa trên Schema
    const newUser = new User({
      email,
      password: hashedPassword,
      displayName,
    });

    // 5. Lưu tài liệu (document) vào Firestore store
    const docRef = await db.collection(COLLECTION_NAME).add(newUser.toFirestore());
    newUser.id = docRef.id;

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
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // 2. So khớp mật khẩu đã được mã hóa thông qua helper utils/hash.js
    const isMatch = await comparePassword(password, data.password);
    if (!isMatch) {
      throw new Error("Email hoặc mật khẩu không chính xác.");
    }

    return new User({ id: doc.id, ...data });
  }

  /**
   * Lấy thông tin người dùng bằng ID.
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getUserById(userId) {
    const doc = await db.collection(COLLECTION_NAME).doc(userId).get();
    if (!doc.exists) {
      throw new Error("Không tìm thấy người dùng.");
    }
    return new User({ id: doc.id, ...doc.data() });
  }

  /**
   * Cập nhật thông tin người dùng.
   * @param {string} userId
   * @param {Object} updateData - Các thông tin muốn thay đổi.
   * @returns {Promise<User>}
   */
  static async updateUser(userId, updateData) {
    const userRef = db.collection(COLLECTION_NAME).doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new Error("Người dùng không tồn tại.");
    }

    const dataToUpdate = {};
    if (updateData.displayName !== undefined) {
      dataToUpdate.displayName = updateData.displayName;
    }

    // Nếu có đổi mật khẩu, tiến hành mã hóa mật khẩu mới thông qua utils/hash.js
    if (updateData.password) {
      if (updateData.password.length < 6) {
        throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      }
      dataToUpdate.password = await hashPassword(updateData.password);
    }

    dataToUpdate.updatedAt = new Date().toISOString();

    // Cập nhật thông tin vào Firestore
    await userRef.update(dataToUpdate);

    // Lấy thông tin mới sau khi cập nhật
    const updatedDoc = await userRef.get();
    return new User({ id: userId, ...updatedDoc.data() });
  }

  /**
   * Xóa người dùng khỏi Firestore.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  static async deleteUser(userId) {
    const userRef = db.collection(COLLECTION_NAME).doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new Error("Người dùng không tồn tại.");
    }

    await userRef.delete();
    return true;
  }
}

module.exports = UserService;
