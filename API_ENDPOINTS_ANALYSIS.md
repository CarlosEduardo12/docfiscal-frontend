# Frontend API Endpoints Analysis - DocFiscal

## Overview
This document provides a comprehensive analysis of all API endpoints that the frontend expects from the backend. The frontend is built with Next.js 14 and uses a centralized API client (`src/lib/api.ts`) for all backend communication.

**Base URL Configuration:**
- Development: `http://localhost:8000` (via `NEXT_PUBLIC_API_URL`)
- Production: `https://responsible-balance-production.up.railway.app`

---

## Authentication Endpoints

### 1. User Registration
**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "ISO8601 timestamp",
    "updated_at": "ISO8601 timestamp"
  },
  "message": "string"
}
```

**Response (Error - 400/500):**
```json
{
  "success": false,
  "error": "string",
  "message": "string",
  "details": {
    "field_errors": {
      "field_name": ["error message"]
    }
  }
}
```

**Authentication Required:** No
**Used By:** `EnhancedRegistrationForm.tsx`, `useRegister()` hook
**Validation Rules:**
- Email must be valid format
- Password must be at least 6 characters
- Name is required

---

### 2. User Login
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "created_at": "ISO8601 timestamp",
      "updated_at": "ISO8601 timestamp"
    },
    "tokens": {
      "access_token": "JWT token",
      "refresh_token": "JWT token"
    }
  },
  "message": "Login successful"
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "message": "string"
}
```

**Authentication Required:** No
**Used By:** `EnhancedLoginForm.tsx`, `useLogin()` hook
**Token Storage:** Tokens stored in localStorage
- `access_token`: Used for authenticated requests
- `refresh_token`: Used to refresh expired access tokens

---

### 3. Token Refresh
**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "JWT token",
      "refresh_token": "JWT token"
    }
  },
  "message": "Token refreshed successfully"
}
```

**Authentication Required:** No (uses refresh token)
**Used By:** `apiClient.refreshAccessToken()` (automatic on 401)
**Auto-Retry:** Yes - automatically called when access token expires

---

### 4. Get Current User Profile
**Endpoint:** `GET /api/auth/me`

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "ISO8601 timestamp",
    "updated_at": "ISO8601 timestamp"
  },
  "message": "User profile retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `useCurrentUser()` hook, `AuthContext.tsx`
**Cache Duration:** 10 minutes (React Query)

---

### 5. User Logout
**Endpoint:** `POST /api/auth/logout`

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Authentication Required:** Yes
**Used By:** `useLogout()` hook
**Side Effects:** Clears all cached data and tokens from localStorage

---

## File Upload Endpoints

### 6. Upload File
**Endpoint:** `POST /api/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Form Field: `file` (File object)

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "upload_id": "string",
    "order_id": "string",
    "filename": "string",
    "file_size": "number (bytes)",
    "status": "uploading|completed|error",
    "progress": "number (0-100)"
  },
  "message": "File uploaded successfully"
}
```

**Response (Error - 400/413/415):**
```json
{
  "success": false,
  "error": "string",
  "message": "string"
}
```

**Authentication Required:** Yes
**Used By:** `useFileUpload()` hook, `UploadArea.tsx`
**File Constraints:**
- Type: `application/pdf` only
- Max Size: 10MB (10485760 bytes)
- Validation: Performed on frontend before upload

---

### 7. Get Upload Progress
**Endpoint:** `GET /api/upload/{uploadId}/progress`

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "upload_id": "string",
    "progress": "number (0-100)",
    "status": "uploading|completed|error",
    "error_message": "string (optional)"
  },
  "message": "Progress retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `useUploadProgress()` hook
**Polling:** Every 1 second while uploading

---

### 8. Cancel Upload
**Endpoint:** `DELETE /api/upload/{uploadId}`

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Upload cancelled"
}
```

**Authentication Required:** Yes
**Used By:** `useFileUpload()` hook (cancelUpload function)

---

## Order Endpoints

### 9. Get All Orders
**Endpoint:** `GET /api/orders`

**Query Parameters:**
```
?page=number&limit=number&sort_by=string&sort_order=asc|desc
```

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "string",
        "user_id": "string",
        "filename": "string",
        "original_file_size": "number (bytes)",
        "status": "pending_payment|paid|processing|completed|failed",
        "payment_id": "string (optional)",
        "payment_url": "string (optional)",
        "download_url": "string (optional)",
        "error_message": "string (optional)",
        "created_at": "ISO8601 timestamp",
        "updated_at": "ISO8601 timestamp",
        "completed_at": "ISO8601 timestamp (optional)"
      }
    ],
    "total": "number",
    "page": "number",
    "limit": "number"
  },
  "message": "Orders retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `useUserOrders()` hook
**Cache Duration:** 2 minutes (React Query)
**Pagination:** Supports page and limit parameters

---

### 10. Get Order by ID
**Endpoint:** `GET /api/orders/{orderId}`

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "user_id": "string",
    "filename": "string",
    "original_file_size": "number (bytes)",
    "status": "pending_payment|paid|processing|completed|failed",
    "payment_id": "string (optional)",
    "payment_url": "string (optional)",
    "download_url": "string (optional)",
    "error_message": "string (optional)",
    "created_at": "ISO8601 timestamp",
    "updated_at": "ISO8601 timestamp",
    "completed_at": "ISO8601 timestamp (optional)"
  },
  "message": "Order retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `useOrderStatus()` hook, `OrderStatusCard.tsx`
**Auto-Polling:** Every 5 seconds for processing/paid orders
**Cache Duration:** Default (5 minutes)

---

### 11. Download Order (Converted File)
**Endpoint:** `GET /api/orders/{orderId}/download`

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
- Content-Type: `text/csv` or `application/octet-stream`
- Body: Binary CSV file data

**Response (Error - 404/410):**
```json
{
  "success": false,
  "error": "File not found or expired",
  "message": "string"
}
```

**Authentication Required:** Yes
**Used By:** `useDownloadFile()` hook, `OrderStatusCard.tsx`
**File Format:** CSV (comma-separated values)
**Filename Pattern:** `converted-{orderId}.csv`

---

### 12. Retry Order Processing
**Endpoint:** `POST /api/orders/{orderId}/retry`

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "processing",
    "message": "Order reprocessing started"
  },
  "message": "Order retry initiated"
}
```

**Authentication Required:** Yes
**Used By:** `useRetryOrder()` hook
**Applicable Status:** `failed` orders only

---

### 13. Get User Orders
**Endpoint:** `GET /api/users/{userId}/orders`

**Query Parameters:**
```
?page=number&limit=number&sort_by=string&sort_order=asc|desc
```

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "string",
        "user_id": "string",
        "filename": "string",
        "original_file_size": "number (bytes)",
        "status": "pending_payment|paid|processing|completed|failed",
        "payment_id": "string (optional)",
        "payment_url": "string (optional)",
        "download_url": "string (optional)",
        "error_message": "string (optional)",
        "created_at": "ISO8601 timestamp",
        "updated_at": "ISO8601 timestamp",
        "completed_at": "ISO8601 timestamp (optional)"
      }
    ],
    "total": "number",
    "page": "number",
    "limit": "number"
  },
  "message": "User orders retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `useUserOrders()` hook
**Cache Duration:** 2 minutes (React Query)

---

## Payment Endpoints

### 14. Initiate Payment
**Endpoint:** `POST /api/orders/{orderId}/payment`

**Request Body:**
```json
{
  "return_url": "string (optional)",
  "cancel_url": "string (optional)"
}
```

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "payment_id": "string",
    "payment_url": "string (MercadoPago checkout URL)",
    "order_id": "string",
    "amount": "number",
    "currency": "string (USD|BRL|etc)",
    "expires_at": "ISO8601 timestamp"
  },
  "message": "Payment created successfully"
}
```

**Response (Error - 400/404):**
```json
{
  "success": false,
  "error": "string",
  "message": "string"
}
```

**Authentication Required:** Yes
**Used By:** `usePaymentFlow()` hook, `useCreatePayment()` hook
**Default URLs:**
- Return: `{NEXT_PUBLIC_PAYMENT_RETURN_URL}` or `/payment/success`
- Cancel: `{NEXT_PUBLIC_PAYMENT_CANCEL_URL}` or `/payment/cancel`
**Integration:** MercadoPago payment gateway
**Order Status Requirement:** Must be `pending_payment`

---

### 15. Get Payment Status
**Endpoint:** `GET /api/payments/{paymentId}/status`

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "payment_id": "string",
    "status": "pending|approved|rejected|cancelled|expired",
    "order_id": "string",
    "amount": "number",
    "currency": "string",
    "error_message": "string (optional)"
  },
  "message": "Payment status retrieved"
}
```

**Authentication Required:** Yes
**Used By:** `usePaymentStatus()` hook, `PaymentStatusPoller.ts`
**Auto-Polling:** Every 10 seconds for pending payments
**Status Values:**
- `pending`: Payment awaiting confirmation
- `approved`: Payment successful
- `rejected`: Payment declined
- `cancelled`: User cancelled payment
- `expired`: Payment link expired

---

### 16. Payment Webhook Callback
**Endpoint:** `POST /api/payments/{paymentId}/callback`

**Request Headers:**
```
Content-Type: application/json
X-Signature: string (MercadoPago signature)
```

**Request Body:**
```json
{
  "id": "string",
  "type": "payment",
  "data": {
    "id": "string"
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

**Authentication Required:** No (webhook signature verification)
**Used By:** MercadoPago webhook system
**Note:** Backend-to-backend communication, not called by frontend

---

## User Profile Endpoints

### 17. Update User Profile
**Endpoint:** `PUT /api/users/{userId}`

**Request Body:**
```json
{
  "name": "string (optional)",
  "email": "string (optional)"
}
```

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "ISO8601 timestamp",
    "updated_at": "ISO8601 timestamp"
  },
  "message": "Profile updated successfully"
}
```

**Authentication Required:** Yes
**Used By:** `useUpdateUserProfile()` hook
**Validation:** Email must be unique if changed

---

## Health Check Endpoint

### 18. Health Check
**Endpoint:** `GET /health`

**Request Headers:**
```
Content-Type: application/json
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Backend is healthy"
}
```

**Authentication Required:** No
**Used By:** `apiClient.healthCheck()`, test pages
**Purpose:** Verify backend connectivity

---

## Error Handling

### Standard Error Response Format
All error responses follow this format:

```json
{
  "success": false,
  "error": "string (error code or message)",
  "message": "string (user-friendly message)",
  "details": {
    "field_errors": {
      "field_name": ["error message 1", "error message 2"]
    },
    "error_count": "number",
    "retry_after": "number (seconds, optional)"
  }
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created (registration, upload)
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (duplicate email, etc.)
- `413`: Payload Too Large (file too large)
- `415`: Unsupported Media Type (wrong file type)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error
- `503`: Service Unavailable

---

## Authentication & Authorization

### Token Management
- **Access Token**: JWT token with limited lifetime (typically 15-30 minutes)
- **Refresh Token**: JWT token with longer lifetime (typically 7-30 days)
- **Storage**: localStorage (keys: `access_token`, `refresh_token`)
- **Auto-Refresh**: Automatic on 401 response

### Request Headers
All authenticated requests must include:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Token Refresh Flow
1. Request fails with 401 status
2. `apiClient.refreshAccessToken()` is called automatically
3. New tokens are obtained from `/api/auth/refresh`
4. Original request is retried with new token
5. If refresh fails, user is logged out

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}
```

### Order
```typescript
interface Order {
  id: string;
  user_id: string;
  filename: string;
  original_file_size: number;
  status: 'pending_payment' | 'paid' | 'processing' | 'completed' | 'failed';
  payment_id?: string;
  payment_url?: string;
  download_url?: string;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}
```

### Payment
```typescript
interface Payment {
  payment_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  order_id: string;
  amount: number;
  currency: string;
  error_message?: string;
}
```

### FileUpload
```typescript
interface FileUpload {
  upload_id: string;
  order_id: string;
  filename: string;
  file_size: number;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
  error_message?: string;
}
```

---

## API Client Configuration

### Base URL
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

### Request Interceptor
- Automatically adds `Authorization` header with access token
- Handles 401 responses with automatic token refresh
- Logs all requests and responses in development

### Response Interceptor
- Parses JSON responses
- Throws errors for non-2xx status codes
- Provides detailed error messages

---

## React Query Integration

### Query Keys
```typescript
queryKeys = {
  auth: {
    currentUser: ['auth', 'currentUser']
  },
  orders: {
    all: ['orders'],
    byUser: (userId) => ['orders', 'user', userId],
    byId: (orderId) => ['orders', orderId],
    userOrders: (userId, params) => ['orders', 'user', userId, params]
  },
  users: {
    all: ['users'],
    byId: (userId) => ['users', userId]
  },
  payments: {
    all: ['payments'],
    byId: (paymentId) => ['payments', paymentId]
  },
  uploads: {
    all: ['uploads'],
    progress: (uploadId) => ['uploads', 'progress', uploadId]
  }
}
```

### Cache Configuration
- **Stale Time**: 5 minutes (default)
- **GC Time**: 24 hours
- **Retry**: Up to 3 times for network errors
- **Persistence**: localStorage with 24-hour expiration

---

## Environment Variables

### Required
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

### Optional
```env
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_PAYMENT_RETURN_URL=http://localhost:3000/payment/success
NEXT_PUBLIC_PAYMENT_CANCEL_URL=http://localhost:3000/payment/cancel
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf
```

---

## Summary of Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | User login |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/me` | Yes | Get current user |
| POST | `/api/auth/logout` | Yes | User logout |
| POST | `/api/upload` | Yes | Upload PDF file |
| GET | `/api/upload/{uploadId}/progress` | Yes | Get upload progress |
| DELETE | `/api/upload/{uploadId}` | Yes | Cancel upload |
| GET | `/api/orders` | Yes | List all orders |
| GET | `/api/orders/{orderId}` | Yes | Get order details |
| GET | `/api/orders/{orderId}/download` | Yes | Download converted file |
| POST | `/api/orders/{orderId}/retry` | Yes | Retry failed order |
| GET | `/api/users/{userId}/orders` | Yes | Get user orders |
| POST | `/api/orders/{orderId}/payment` | Yes | Initiate payment |
| GET | `/api/payments/{paymentId}/status` | Yes | Get payment status |
| POST | `/api/payments/{paymentId}/callback` | No | Payment webhook |
| PUT | `/api/users/{userId}` | Yes | Update user profile |
| GET | `/health` | No | Health check |

---

## Implementation Notes

### Frontend API Client Location
- **File**: `src/lib/api.ts`
- **Class**: `ApiClient`
- **Export**: `apiClient` (singleton instance)

### React Query Hooks Location
- **File**: `src/lib/react-query.ts`
- **Hooks**: `useLogin()`, `useRegister()`, `useLogout()`, `useCurrentUser()`, `useOrderStatus()`, `useUserOrders()`, `useFileUpload()`, `useCreatePayment()`, `usePaymentStatus()`, `useDownloadFile()`, etc.

### Component Usage Examples
- **Login**: `src/components/forms/EnhancedLoginForm.tsx`
- **Registration**: `src/components/forms/EnhancedRegistrationForm.tsx`
- **Upload**: `src/components/upload/UploadArea.tsx`
- **Order Status**: `src/components/order/OrderStatusCard.tsx`
- **Order History**: `src/components/order/OrderHistoryTable.tsx`

---

## Testing

### Mock API Responses
Test files mock API responses using Jest:
- `src/__tests__/AuthForms.test.tsx` - Authentication tests
- `src/__tests__/payment-security.property.test.ts` - Payment tests
- `src/__tests__/upload-workflow.property.test.ts` - Upload tests

### Test API Pages
Development pages for testing API connectivity:
- `/test-api` - Basic API tests
- `/test-api-connection` - Connection tests
- `/test-upload` - Upload tests
- `/test-payment` - Payment tests
- `/debug-payment` - Payment debugging

---

## Performance Considerations

### Caching Strategy
- User data: 10 minutes
- Order lists: 2 minutes
- Order details: 5 minutes (auto-poll for processing)
- Payment status: 10 seconds (auto-poll for pending)
- Upload progress: 1 second (while uploading)

### Optimization Techniques
- Query persistence in localStorage
- Automatic background refetching
- Optimistic updates for mutations
- Request deduplication
- Lazy loading of data

---

## Security Considerations

### Token Security
- Tokens stored in localStorage (consider httpOnly cookies for production)
- Automatic token refresh on expiration
- Tokens cleared on logout
- CORS headers required from backend

### Request Security
- All authenticated requests include Authorization header
- Content-Type validation
- File type and size validation on frontend
- HTTPS required in production

### CSRF Protection
- NextAuth.js handles CSRF tokens
- Credentials provider validates on backend

---

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify backend CORS configuration
   - Check `NEXT_PUBLIC_API_URL` environment variable
   - Ensure backend is running

2. **401 Unauthorized**
   - Check if tokens are stored in localStorage
   - Verify token hasn't expired
   - Try logging out and logging back in

3. **Upload Failures**
   - Verify file is PDF format
   - Check file size is under 10MB
   - Ensure backend upload endpoint is working

4. **Payment Issues**
   - Verify MercadoPago configuration
   - Check payment return URLs
   - Ensure order is in `pending_payment` status

---

## Future Enhancements

### Planned Endpoints
- Real-time notifications (WebSocket)
- Batch file uploads
- Order history export
- Payment history
- User preferences/settings
- Admin endpoints

### Planned Features
- Webhook support for real-time updates
- File preview before conversion
- Conversion progress tracking
- Multiple file format support
- Scheduled conversions
