# Requirements Document

## Introduction

This specification defines the requirements for updating the DocFiscal frontend application to align with the updated backend OpenAPI specification (v2.0.0). The frontend currently has several API endpoint mismatches and missing implementations that need to be addressed to ensure proper integration with the backend services.

## Glossary

- **Frontend**: The Next.js React application that provides the user interface
- **Backend**: The REST API service defined by the OpenAPI specification
- **API_Client**: The frontend service responsible for making HTTP requests to the backend
- **Order_Management**: The system for handling PDF conversion orders
- **Payment_System**: The AbacatePay integration for processing payments
- **User_Management**: The system for handling user profiles and authentication
- **Upload_Service**: The system for handling PDF file uploads

## Requirements

### Requirement 1: Authentication Endpoints Alignment

**User Story:** As a developer, I want the frontend authentication system to match the backend API specification, so that user authentication works correctly.

#### Acceptance Criteria

1. WHEN a user registers, THE Frontend SHALL send requests to `/api/auth/register` with the correct payload structure
2. WHEN a user logs in, THE Frontend SHALL send requests to `/api/auth/login` and handle the standardized response format
3. WHEN tokens need refreshing, THE Frontend SHALL use `/api/auth/refresh` with the correct refresh token payload
4. WHEN getting user profile, THE Frontend SHALL use `/api/auth/me` endpoint
5. WHEN logging out, THE Frontend SHALL call `/api/auth/logout` endpoint

### Requirement 2: File Upload Endpoints Standardization

**User Story:** As a user, I want to upload PDF files through a standardized API interface, so that file uploads work reliably.

#### Acceptance Criteria

1. WHEN uploading a file, THE Frontend SHALL use `/api/upload/` endpoint (with trailing slash)
2. WHEN checking upload progress, THE Frontend SHALL use `/api/upload/{upload_id}/progress` endpoint
3. WHEN canceling uploads, THE Frontend SHALL use DELETE method on `/api/upload/{upload_id}` endpoint
4. WHEN handling upload responses, THE Frontend SHALL process the standardized response format with upload_id and order_id

### Requirement 3: Order Management Endpoints Update

**User Story:** As a user, I want to manage my conversion orders through properly aligned API endpoints, so that order operations work correctly.

#### Acceptance Criteria

1. WHEN listing orders, THE Frontend SHALL use `/api/orders` with proper query parameters (page, limit, status, sort, order)
2. WHEN getting order details, THE Frontend SHALL use `/api/orders/{order_id}` endpoint
3. WHEN retrying failed orders, THE Frontend SHALL use POST method on `/api/orders/{order_id}/retry` endpoint
4. WHEN downloading processed files, THE Frontend SHALL use `/api/orders/{order_id}/download` endpoint
5. WHEN handling order responses, THE Frontend SHALL process the standardized pagination and order data structures

### Requirement 4: Payment System Integration

**User Story:** As a user, I want to make payments for my orders through the integrated payment system, so that I can complete my conversions.

#### Acceptance Criteria

1. WHEN initiating payments, THE Frontend SHALL use POST method on `/api/payments/orders/{order_id}/payment` endpoint
2. WHEN checking payment status, THE Frontend SHALL use `/api/payments/{payment_id}` endpoint (not `/api/payments/{payment_id}/status`)
3. WHEN handling payment responses, THE Frontend SHALL process the standardized payment response format with checkout_url and qr_code fields
4. WHEN processing payment methods, THE Frontend SHALL support both 'pix' and 'credit_card' options

### Requirement 5: User Management Endpoints Implementation

**User Story:** As a user, I want to manage my profile and account settings, so that I can update my information and change my password.

#### Acceptance Criteria

1. WHEN updating user profile, THE Frontend SHALL use PUT method on `/api/users/me` endpoint (not `/api/users/{userId}`)
2. WHEN changing password, THE Frontend SHALL use PUT method on `/api/users/me/password` endpoint
3. WHEN handling profile updates, THE Frontend SHALL process the standardized user profile response format
4. WHEN validating password changes, THE Frontend SHALL require both current_password and new_password fields

### Requirement 6: Response Format Standardization

**User Story:** As a developer, I want all API responses to follow a consistent format, so that error handling and data processing are uniform.

#### Acceptance Criteria

1. WHEN processing API responses, THE Frontend SHALL handle the standardized response format with success, data, and message fields
2. WHEN handling errors, THE Frontend SHALL process the standardized error format with error codes and field_errors
3. WHEN displaying error messages, THE Frontend SHALL use the message field from error responses
4. WHEN handling validation errors, THE Frontend SHALL display field-specific errors from the details.field_errors object

### Requirement 7: Health Check Implementation

**User Story:** As a system administrator, I want to monitor the system health, so that I can ensure the application is running properly.

#### Acceptance Criteria

1. WHEN checking system health, THE Frontend SHALL use `/health` endpoint (not requiring authentication)
2. WHEN processing health responses, THE Frontend SHALL handle the detailed health status including services status
3. WHEN displaying health information, THE Frontend SHALL show database, storage, and payment_provider status

### Requirement 8: Webhook Endpoint Awareness

**User Story:** As a developer, I want to be aware of webhook endpoints, so that I understand the complete API surface.

#### Acceptance Criteria

1. THE Frontend SHALL NOT implement webhook endpoints directly (they are for external use)
2. THE Frontend SHALL be aware that payment status updates may come through webhooks
3. THE Frontend SHALL implement proper payment status polling to handle webhook-triggered updates

### Requirement 9: Query Parameter Standardization

**User Story:** As a user, I want consistent query parameter handling across all list endpoints, so that filtering and sorting work uniformly.

#### Acceptance Criteria

1. WHEN making paginated requests, THE Frontend SHALL use 'page' and 'limit' parameters consistently
2. WHEN sorting results, THE Frontend SHALL use 'sort' and 'order' parameters (not 'sort_by' and 'sort_order')
3. WHEN filtering orders, THE Frontend SHALL support 'status' parameter with enum values
4. WHEN handling pagination responses, THE Frontend SHALL process the standardized pagination object

### Requirement 10: File Download Security

**User Story:** As a user, I want secure file downloads with proper error handling, so that I can reliably access my converted files.

#### Acceptance Criteria

1. WHEN downloading files, THE Frontend SHALL handle 410 "Download link expired" responses
2. WHEN processing download responses, THE Frontend SHALL handle proper Content-Disposition headers
3. WHEN download fails, THE Frontend SHALL display appropriate error messages based on error codes
4. WHEN download links expire, THE Frontend SHALL provide options to regenerate or retry

### Requirement 11: Frontend Route Handlers Removal

**User Story:** As a developer, I want to remove mock API route handlers from the frontend, so that all API calls go directly to the backend.

#### Acceptance Criteria

1. WHEN the frontend is updated, THE Frontend SHALL remove all mock API route handlers from `/src/app/api/` directory
2. WHEN API calls are made, THE Frontend SHALL send requests directly to the backend server
3. WHEN authentication is needed, THE Frontend SHALL use the backend authentication endpoints
4. WHEN removing route handlers, THE Frontend SHALL ensure no components depend on local API routes

### Requirement 12: Component API Integration Updates

**User Story:** As a developer, I want all components to use the updated API client, so that they work with the new backend endpoints.

#### Acceptance Criteria

1. WHEN components make API calls, THE Components SHALL use the updated apiClient methods
2. WHEN handling responses, THE Components SHALL process the standardized response format
3. WHEN displaying errors, THE Components SHALL use the new error format structure
4. WHEN updating state, THE Components SHALL handle the new data structures from the backend

### Requirement 13: Hook and Service Updates

**User Story:** As a developer, I want all hooks and services to work with the updated API, so that state management and data fetching work correctly.

#### Acceptance Criteria

1. WHEN hooks fetch data, THE Hooks SHALL use the updated API endpoints and response formats
2. WHEN services process data, THE Services SHALL handle the new data structures
3. WHEN caching data, THE Services SHALL use the correct cache keys for the new endpoints
4. WHEN handling authentication, THE Services SHALL use the new token management system

### Requirement 14: Page and Layout Updates

**User Story:** As a user, I want all pages to work with the updated backend, so that the application functions correctly.

#### Acceptance Criteria

1. WHEN pages load data, THE Pages SHALL use the updated API endpoints
2. WHEN displaying information, THE Pages SHALL show data in the new format
3. WHEN handling user interactions, THE Pages SHALL send requests to the correct endpoints
4. WHEN routing between pages, THE Pages SHALL maintain compatibility with the new API structure

### Requirement 15: Test Updates

**User Story:** As a developer, I want all tests to pass with the updated API, so that the application remains reliable.

#### Acceptance Criteria

1. WHEN running tests, THE Tests SHALL use the updated API endpoints and response formats
2. WHEN mocking API calls, THE Tests SHALL mock the correct endpoints with proper response structures
3. WHEN testing components, THE Tests SHALL verify compatibility with the new API format
4. WHEN testing error scenarios, THE Tests SHALL use the new error response format