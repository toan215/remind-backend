const admin = require("firebase-admin");

let serviceAccount;

// 1. Thử đọc thông tin cấu hình từ biến môi trường (.env)
if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

// Khởi tạo Firebase Admin với cấu hình tìm được
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  // Khởi tạo mặc định (khi deploy lên Google Cloud Infrastructure như GCP/Cloud Functions)
  try {
    admin.initializeApp();
  } catch (err) {
    console.warn(
      "\n⚠️  [Firebase Warning]: Chưa cấu hình tài khoản liên kết Firebase.\n" +
      "👉 Vui lòng điền thông tin xác thực trong tệp .env\n"
    );
  }
}

const auth = admin.auth();
const db = admin.firestore();

module.exports = { admin, auth, db };
