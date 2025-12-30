# Authentication Redirect Flow Analysis

## Current Problematic Flows

### Flow 1: Successful Login → Dashboard (Working Case)

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant ApiClient
    participant LocalStorage
    participant Dashboard
    participant useAuthNew

    User->>LoginForm: Submit credentials
    LoginForm->>ApiClient: login(email, password)
    ApiClient->>LocalStorage: setItem('access_token', token)
    ApiClient->>LocalStorage: setItem('refresh_token', token)
    ApiClient-->>LoginForm: {success: true, data: {...}}
    LoginForm->>Dashboard: router.push('/dashboard')
    Dashboard->>useAuthNew: useRequireAuth()
    useAuthNew->>ApiClient: isAuthenticated
    ApiClient->>LocalStorage: getItem('access_token')
    LocalStorage-->>ApiClient: token_value
    ApiClient-->>useAuthNew: true
    useAuthNew-->>Dashboard: {user: {...}, isAuthenticated: true}
    Dashboard->>User: Show dashboard content
```

### Flow 2: Login → Redirect Loop (Production Issue)

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant ApiClient
    participant LocalStorage
    participant Dashboard
    participant useAuthNew
    participant Router

    User->>LoginForm: Submit credentials
    LoginForm->>ApiClient: login(email, password)
    ApiClient->>LocalStorage: setItem('access_token', token)
    Note over LocalStorage: Token stored successfully
    ApiClient-->>LoginForm: {success: true}
    LoginForm->>Router: router.push('/dashboard')
    
    Note over Dashboard: Component mounts
    Dashboard->>useAuthNew: useRequireAuth()
    useAuthNew->>ApiClient: isAuthenticated
    ApiClient->>LocalStorage: getItem('access_token')
    
    Note over LocalStorage: Race condition or<br/>token retrieval failure
    LocalStorage-->>ApiClient: null or undefined
    ApiClient-->>useAuthNew: false
    
    Note over useAuthNew: Auth check fails
    useAuthNew->>Router: router.push('/login')
    Router->>LoginForm: Redirect to login
    
    Note over User: User sees login page<br/>despite successful login
```

### Flow 3: Page Refresh → Authentication Loss

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Dashboard
    participant useAuthNew
    participant ApiClient
    participant LocalStorage
    participant Router

    Note over User: User refreshes page<br/>while authenticated
    Browser->>Dashboard: Page reload
    Dashboard->>useAuthNew: useRequireAuth()
    
    Note over useAuthNew: Initial state:<br/>isLoading: true<br/>isAuthenticated: false
    
    useAuthNew->>ApiClient: checkAuth()
    ApiClient->>LocalStorage: getItem('access_token')
    
    alt Token exists but expired
        LocalStorage-->>ApiClient: expired_token
        ApiClient->>ApiClient: refreshAccessToken()
        
        alt Refresh succeeds
            ApiClient->>LocalStorage: setItem('access_token', new_token)
            ApiClient-->>useAuthNew: Authentication restored
            useAuthNew-->>Dashboard: {isAuthenticated: true}
        else Refresh fails
            ApiClient->>LocalStorage: removeItem('access_token')
            ApiClient-->>useAuthNew: Authentication failed
            useAuthNew->>Router: router.push('/login')
        end
    else Token missing
        LocalStorage-->>ApiClient: null
        ApiClient-->>useAuthNew: Not authenticated
        useAuthNew->>Router: router.push('/login')
    end
```

## Token Storage Inconsistency Flows

### Flow 4: AuthTokenManager vs ApiClient Mismatch

```mermaid
sequenceDiagram
    participant LoginForm
    participant ApiClient
    participant AuthTokenManager
    participant LocalStorage
    participant Component

    Note over LoginForm: User logs in successfully
    LoginForm->>ApiClient: login()
    ApiClient->>LocalStorage: setItem('access_token', token)
    ApiClient->>LocalStorage: setItem('refresh_token', token)
    
    Note over Component: Later, component uses AuthContext
    Component->>AuthTokenManager: getValidToken()
    AuthTokenManager->>LocalStorage: getItem('docfiscal_access_token')
    LocalStorage-->>AuthTokenManager: null (different key!)
    AuthTokenManager-->>Component: null (not authenticated)
    
    Note over Component: Authentication appears to fail<br/>despite valid tokens in storage
```

## Race Condition Scenarios

### Flow 5: Multiple Components Checking Auth Simultaneously

```mermaid
sequenceDiagram
    participant Dashboard
    participant Upload
    participant TestPage
    participant ApiClient
    participant Server

    Note over Dashboard,TestPage: Multiple components mount simultaneously
    
    par Dashboard Auth Check
        Dashboard->>ApiClient: getProfile()
        ApiClient->>Server: GET /api/auth/me
    and Upload Auth Check
        Upload->>ApiClient: getProfile()
        ApiClient->>Server: GET /api/auth/me
    and TestPage Auth Check
        TestPage->>ApiClient: getProfile()
        ApiClient->>Server: GET /api/auth/me
    end
    
    Note over Server: Multiple simultaneous requests<br/>may cause rate limiting or<br/>inconsistent responses
    
    Server-->>ApiClient: Response 1
    Server-->>ApiClient: Response 2
    Server-->>ApiClient: Response 3
    
    Note over Dashboard,TestPage: Components may receive<br/>different authentication states
```

## Production Environment Specific Issues

### Flow 6: HTTPS/CORS Issues in Production

```mermaid
sequenceDiagram
    participant Browser
    participant Frontend
    participant ApiClient
    participant ProductionAPI
    participant LocalStorage

    Browser->>Frontend: Load app (HTTPS)
    Frontend->>ApiClient: Initialize
    ApiClient->>LocalStorage: getItem('access_token')
    LocalStorage-->>ApiClient: token (HTTP context)
    
    Note over ApiClient: Token may be invalid<br/>for HTTPS context
    
    ApiClient->>ProductionAPI: Request with token
    
    alt CORS/Security Issue
        ProductionAPI-->>ApiClient: 401/403 (CORS error)
        ApiClient->>LocalStorage: clearTokens()
        ApiClient-->>Frontend: Not authenticated
        Frontend->>Browser: Redirect to login
    else Token Context Issue
        ProductionAPI-->>ApiClient: 401 (Invalid token)
        ApiClient->>ApiClient: refreshAccessToken()
        ApiClient->>ProductionAPI: Refresh request
        ProductionAPI-->>ApiClient: 401 (Refresh also fails)
        ApiClient-->>Frontend: Authentication failed
    end
```

## Identified Root Causes

### 1. Token Storage Key Mismatch
- **ApiClient** uses: `access_token`, `refresh_token`
- **AuthTokenManager** uses: `docfiscal_access_token`, `docfiscal_refresh_token`
- **Result**: Systems cannot read each other's tokens

### 2. Multiple Authentication State Sources
- Each component maintains independent auth state
- No centralized state management
- Race conditions between components

### 3. Missing Global Authentication Provider
- `AuthProvider` not integrated in app layout
- Components use different auth implementations
- No shared authentication context

### 4. Inconsistent Redirect Logic
- Multiple components can trigger redirects
- No coordination between redirect attempts
- Potential for infinite redirect loops

### 5. Production Environment Differences
- Different API URLs between dev/prod
- HTTPS vs HTTP token context issues
- CORS configuration problems

## Recommended Flow (Target State)

### Flow 7: Unified Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant LoginForm
    participant AuthContext
    participant AuthTokenManager
    participant LocalStorage
    participant Dashboard

    User->>LoginForm: Submit credentials
    LoginForm->>AuthContext: login(email, password)
    AuthContext->>AuthTokenManager: storeTokens(tokens)
    AuthTokenManager->>LocalStorage: setItem('docfiscal_access_token', token)
    AuthTokenManager->>LocalStorage: setItem('docfiscal_refresh_token', token)
    AuthContext-->>LoginForm: {success: true}
    LoginForm->>Dashboard: router.push('/dashboard')
    
    Dashboard->>AuthContext: useAuth()
    Note over AuthContext: Global state already<br/>knows user is authenticated
    AuthContext-->>Dashboard: {user: {...}, isAuthenticated: true}
    Dashboard->>User: Show dashboard content
    
    Note over AuthContext,Dashboard: No additional API calls needed<br/>Single source of truth
```

## Testing Scenarios Required

### 1. Token Storage Consistency Tests
- Verify tokens stored by one system can be read by another
- Test token migration between key formats
- Validate token expiration handling

### 2. Redirect Behavior Tests
- Test successful login → dashboard flow
- Test authentication failure → login redirect
- Test prevention of infinite redirect loops

### 3. Race Condition Tests
- Test multiple components mounting simultaneously
- Test concurrent authentication checks
- Test state synchronization across components

### 4. Production Environment Tests
- Test HTTPS token handling
- Test CORS configuration
- Test environment variable usage

### 5. Session Persistence Tests
- Test page refresh with valid tokens
- Test browser restart with stored tokens
- Test token refresh on expiration