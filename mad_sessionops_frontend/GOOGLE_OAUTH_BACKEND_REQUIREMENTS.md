# Google OAuth Backend Requirements

## Overview

This document outlines the backend API requirements for the Google OAuth 2.0 integration using Authorization Code Flow with PKCE.

---

## Required Endpoint

### `POST /api/auth/google/oauth/callback`

This endpoint receives the authorization code from the frontend after the user authorizes with Google, exchanges it with Google for tokens, and creates/updates the user session.

---

## Request

### Headers

```
Content-Type: application/json
```

### Body

```json
{
  "code": "string", // Authorization code from Google
  "codeVerifier": "string", // PKCE code verifier (128 chars)
  "redirectUri": "string" // Must match the redirect URI configured in Google Console
}
```

### Example Request

```json
{
  "code": "4/0ATX87lMhdnyy3HrF7Jd15QuBL0sIOro5oDcN48mo069_9ZbVNSDgfLdaGcUH8mzQzulTSA",
  "codeVerifier": "wpXR4oClmh9vdxpqT7RtymqPwk_lusiPEIaTzE0-vDzWq_unoFpjrOQCsoW3hCEzHAjfA~CAuOHY_fveCy3F5Ca3zZOZWtZ~.xC",
  "redirectUri": "http://localhost:3000/auth/callback/google"
}
```

---

## Backend Implementation Steps

### Step 1: Exchange Authorization Code for Tokens

Make a POST request to Google's token endpoint:

```http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code={code}
&client_id={GOOGLE_CLIENT_ID}
&client_secret={GOOGLE_CLIENT_SECRET}
&redirect_uri={redirectUri}
&code_verifier={codeVerifier}
&grant_type=authorization_code
```

**Google Response:**

```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "expires_in": 3599,
  "scope": "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
  "token_type": "Bearer",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### Step 2: Decode and Verify ID Token

Decode the `id_token` JWT to extract user information:

```json
{
  "iss": "https://accounts.google.com",
  "sub": "1234567890", // Google User ID
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "given_name": "John",
  "family_name": "Doe",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Important:** Verify the ID token signature using Google's public keys:

- https://www.googleapis.com/oauth2/v3/certs

### Step 3: Create or Update User

```python
# Pseudo-code
user = db.find_or_create_user(
    email=id_token['email'],
    google_id=id_token['sub'],
    name=id_token['name'],
    avatar=id_token['picture'],
    email_verified=id_token['email_verified']
)
```

### Step 4: Generate Your App's Tokens

Create JWT tokens for your application:

```python
# Generate access token (JWT)
access_token = create_jwt_token(
    user_id=user.id,
    expires_in=3600  # 1 hour
)

# Generate refresh token
refresh_token = create_refresh_token(
    user_id=user.id,
    expires_in=2592000  # 30 days
)
```

---

## Response

### Success Response (200 OK)

```json
{
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "avatar": "string",
    "role": "string",
    "roles": ["string"],
    "permissions": ["string"],
    "emailVerified": boolean,
    "createdAt": "ISO 8601 string",
    "updatedAt": "ISO 8601 string"
  },
  "accessToken": "string",
  "refreshToken": "string",
  "expiresIn": number
}
```

### Example Success Response

```json
{
  "user": {
    "id": "usr_123456",
    "email": "gaurav.thwait@makeadiff.in",
    "name": "Gaurav Thwait",
    "avatar": "https://lh3.googleusercontent.com/a/...",
    "role": "user",
    "roles": ["user"],
    "permissions": ["read:profile", "write:profile"],
    "emailVerified": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

---

## Error Responses

### 400 Bad Request - Invalid Code

```json
{
  "code": "INVALID_CODE",
  "message": "The authorization code is invalid or has expired"
}
```

### 401 Unauthorized - Invalid Client

```json
{
  "code": "INVALID_CLIENT",
  "message": "Invalid client credentials"
}
```

### 422 Unprocessable Entity - Validation Error

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "errors": {
    "code": ["Code is required"],
    "codeVerifier": ["Code verifier is required"],
    "redirectUri": ["Redirect URI is required"]
  }
}
```

### 500 Internal Server Error

```json
{
  "code": "SERVER_ERROR",
  "message": "An internal server error occurred"
}
```

---

## Environment Variables Required

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Your App Configuration
APP_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=2592000
```

---

## Security Checklist

- [ ] Validate `redirectUri` matches allowed origins
- [ ] Verify ID token signature with Google's public keys
- [ ] Check ID token `iss` claim is `https://accounts.google.com`
- [ ] Verify ID token `aud` claim matches your `GOOGLE_CLIENT_ID`
- [ ] Check ID token `exp` (expiration) hasn't passed
- [ ] Store `google_id` (sub claim) to link user to Google account
- [ ] Use HTTPS in production
- [ ] Rate limit the endpoint
- [ ] Log OAuth attempts for security monitoring
- [ ] Never expose `GOOGLE_CLIENT_SECRET` to frontend

---

## Testing the Endpoint

### Using cURL

```bash
curl -X POST http://localhost:8000/api/auth/google/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0ATX87lMhdnyy...",
    "codeVerifier": "wpXR4oClmh9vdxpqT7...",
    "redirectUri": "http://localhost:3000/auth/callback/google"
  }'
```

### Expected Flow

1. Frontend sends request with `code` and `codeVerifier`
2. Backend exchanges code with Google
3. Backend receives Google tokens and user info
4. Backend creates/updates user in database
5. Backend generates app tokens
6. Backend returns user + tokens to frontend
7. Frontend stores tokens and redirects to dashboard

---

## Database Schema Suggestion

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  google_id VARCHAR(255) UNIQUE,  -- Store Google's sub claim
  email_verified BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

---

## Python/Django Example

```python
import requests
import jwt
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
def google_oauth_callback(request):
    # Extract request data
    code = request.data.get('code')
    code_verifier = request.data.get('codeVerifier')
    redirect_uri = request.data.get('redirectUri')

    # Validate inputs
    if not all([code, code_verifier, redirect_uri]):
        return Response({
            'code': 'VALIDATION_ERROR',
            'message': 'Missing required fields'
        }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    try:
        # Step 1: Exchange code with Google
        token_response = requests.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': settings.GOOGLE_CLIENT_ID,
                'client_secret': settings.GOOGLE_CLIENT_SECRET,
                'redirect_uri': redirect_uri,
                'code_verifier': code_verifier,
                'grant_type': 'authorization_code'
            }
        )

        if token_response.status_code != 200:
            return Response({
                'code': 'GOOGLE_ERROR',
                'message': 'Failed to exchange code with Google'
            }, status=status.HTTP_400_BAD_REQUEST)

        tokens = token_response.json()

        # Step 2: Decode ID token
        id_token = jwt.decode(
            tokens['id_token'],
            options={"verify_signature": False}  # In production, verify signature!
        )

        # Step 3: Create or update user
        user, created = User.objects.update_or_create(
            google_id=id_token['sub'],
            defaults={
                'email': id_token['email'],
                'name': id_token['name'],
                'avatar': id_token.get('picture'),
                'email_verified': id_token.get('email_verified', False)
            }
        )

        # Step 4: Generate app tokens
        access_token = generate_access_token(user)
        refresh_token = generate_refresh_token(user)

        # Step 5: Return response
        return Response({
            'user': {
                'id': str(user.id),
                'email': user.email,
                'name': user.name,
                'avatar': user.avatar,
                'role': user.role,
                'emailVerified': user.email_verified,
                'createdAt': user.created_at.isoformat(),
                'updatedAt': user.updated_at.isoformat()
            },
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'expiresIn': 3600
        })

    except Exception as e:
        return Response({
            'code': 'SERVER_ERROR',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

---

## Node.js/Express Example

```javascript
const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");

app.post("/api/auth/google/oauth/callback", async (req, res) => {
  const { code, codeVerifier, redirectUri } = req.body;

  // Validate inputs
  if (!code || !codeVerifier || !redirectUri) {
    return res.status(422).json({
      code: "VALIDATION_ERROR",
      message: "Missing required fields",
    });
  }

  try {
    // Step 1: Exchange code with Google
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { id_token } = tokenResponse.data;

    // Step 2: Decode ID token
    const decoded = jwt.decode(id_token);

    // Step 3: Create or update user
    const user = await User.findOneAndUpdate(
      { googleId: decoded.sub },
      {
        email: decoded.email,
        name: decoded.name,
        avatar: decoded.picture,
        emailVerified: decoded.email_verified,
      },
      { upsert: true, new: true }
    );

    // Step 4: Generate app tokens
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: "30d",
    });

    // Step 5: Return response
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Google OAuth Error:", error);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Failed to process Google OAuth",
    });
  }
});
```

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Google Token Endpoint](https://oauth2.googleapis.com/token)
- [Google UserInfo Endpoint](https://www.googleapis.com/oauth2/v1/userinfo)
- [JWT.io - Decode JWT tokens](https://jwt.io/)

---

## Frontend Integration

The frontend is already configured and will:

1. Initiate OAuth flow from `/login` page
2. Redirect to Google for authorization
3. Receive callback at `/auth/callback/google`
4. Extract `code` from URL
5. Call `POST /api/auth/google/oauth/callback`
6. Store tokens in Redux + localStorage
7. Redirect to `/dashboard`

Frontend endpoint called: `authService.loginWithGoogleOAuth()`
Location: `lib/api/services/auth.service.ts:43-49`
