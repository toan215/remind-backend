# Auth API

Base path: `/api/auth`

## POST /api/auth/register

Register a new user account. Students default to `active`, experts default to `pending`.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "role": "student"
}
```

`role` is optional (defaults to `student`). Accepted values: `student`, `expert`.

### Response

**201 Created**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "student",
    "status": "active"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

**409 Conflict** — Email already exists

## POST /api/auth/login

Authenticate with email and password.

### Request Body

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Response

**200 OK** — Returns same shape as register
**401 Unauthorized** — Invalid credentials
**403 Forbidden** — Account is banned or rejected

## POST /api/auth/google

Login or register via Google access token. Uses Google's userinfo API (`https://www.googleapis.com/oauth2/v3/userinfo`) for server-side verification.

New users are created as `student` / `active`. Existing users are logged in; `googleId` is linked if not already set.

### Request Body

```json
{
  "googleToken": "<access_token from Google OAuth>"
}
```

### Response

**200 OK** — Returns same shape as login/register
**400 Bad Request** — Missing or invalid token
**401 Unauthorized** — Invalid Google token
**403 Forbidden** — Account is banned or rejected

### Frontend Integration

Frontend uses `@react-oauth/google`'s `useGoogleLogin` hook (implicit flow):

```ts
const loginWithGoogle = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    const result = await AuthController.googleLogin(tokenResponse.access_token);
    // result.user, result.accessToken, result.refreshToken available
  }
});
```

## POST /api/auth/refresh

Exchange a refresh token for a new token pair (rotation).

### Request Body

```json
{
  "refreshToken": "..."
}
```

### Response

**200 OK** — New tokens returned (same shape). Old refresh token is invalidated.
**401 Unauthorized** — Invalid or reused refresh token

## POST /api/auth/logout

Invalidate the current refresh token.

### Request Body

```json
{
  "refreshToken": "..."
}
```

### Response

**200 OK**
```json
{
  "message": "Logged out successfully"
}
```

## POST /api/auth/forgot-password

Request an OTP (One-Time Password) to reset password. Send email containing OTP to user.

### Request Body

```json
{
  "email": "user@example.com"
}
```

### Response

**200 OK**
```json
{
  "message": "OTP sent successfully"
}
```

**400 Bad Request** — Missing email
**404 Not Found** — Email does not exist

## POST /api/auth/reset-password

Validate OTP and update user's password.

### Request Body

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newsecurepassword"
}
```

### Response

**200 OK**
```json
{
  "message": "Password reset successfully"
}
```

**400 Bad Request** — Missing required fields, password less than 6 characters, invalid OTP, or expired OTP
**404 Not Found** — User not found

