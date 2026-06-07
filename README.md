@baseUrl = http://localhost:3000/api

### 1. Đăng ký tài khoản mới (Register User)

# @name register

POST {{baseUrl}}/users/register
Content-Type: application/json

{
"email": "testuser@example.com",
"password": "mySecurePassword123",
"displayName": "Test User"
}

### Lưu lại ID của user vừa đăng ký từ response để test các request tiếp theo

@userId = {{register.response.body.user.id}}

### 2. Đăng nhập (Login User)

POST {{baseUrl}}/users/login
Content-Type: application/json

{
"email": "testuser@example.com",
"password": "mySecurePassword123"
}

### 3. Lấy thông tin User theo ID

# Sử dụng userId từ bước 1 hoặc điền ID thủ công

GET {{baseUrl}}/users/{{userId}}

### 4. Cập nhật thông tin User (Đổi tên hiển thị & mật khẩu)

PUT {{baseUrl}}/users/{{userId}}
Content-Type: application/json

{
"displayName": "Updated Test User",
"password": "newSecurePassword456"
}

### 5. Xóa User

DELETE {{baseUrl}}/users/{{userId}}
