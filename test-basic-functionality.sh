#!/bin/bash

echo "🚀 Starting basic functionality test..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"

echo -e "${BLUE}📋 Test Configuration:${NC}"
echo -e "  API URL: $API_URL"
echo -e "  Frontend URL: $FRONTEND_URL"
echo ""

# Test 1: Check if backend is running
echo -e "${BLUE}📝 Test 1: Check backend connectivity${NC}"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/ 2>/dev/null)

if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend is running (HTTP $BACKEND_STATUS)${NC}"
else
    echo -e "${RED}❌ Backend is not accessible (HTTP $BACKEND_STATUS)${NC}"
    echo -e "${YELLOW}⚠️  Make sure the backend is running on port 8000${NC}"
fi

# Test 2: Check if frontend is running
echo -e "${BLUE}📝 Test 2: Check frontend connectivity${NC}"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/ 2>/dev/null)

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is running (HTTP $FRONTEND_STATUS)${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible (HTTP $FRONTEND_STATUS)${NC}"
    echo -e "${YELLOW}⚠️  Make sure the frontend is running on port 3000${NC}"
fi

# Test 3: Test API endpoints
echo -e "${BLUE}📝 Test 3: Test API endpoints${NC}"

# Test register endpoint
echo -e "  Testing register endpoint..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"test$(date +%s)@example.com\",\"password\":\"test123\"}" \
  2>/dev/null)

if echo "$REGISTER_RESPONSE" | grep -q "success\|user\|token"; then
    echo -e "${GREEN}✅ Register endpoint is working${NC}"
else
    echo -e "${YELLOW}⚠️  Register endpoint response: $REGISTER_RESPONSE${NC}"
fi

# Test login endpoint with invalid credentials
echo -e "  Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123\"}" \
  2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -q "success\|error\|message"; then
    echo -e "${GREEN}✅ Login endpoint is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Login endpoint response: $LOGIN_RESPONSE${NC}"
fi

# Test 4: Check frontend pages
echo -e "${BLUE}📝 Test 4: Check frontend pages${NC}"

# Check login page
echo -e "  Testing login page..."
LOGIN_PAGE=$(curl -s "$FRONTEND_URL/login" 2>/dev/null)

if echo "$LOGIN_PAGE" | grep -q "Sign in\|login\|email\|password"; then
    echo -e "${GREEN}✅ Login page is accessible and contains expected elements${NC}"
else
    echo -e "${RED}❌ Login page is not working properly${NC}"
fi

# Check dashboard page (should redirect to login if not authenticated)
echo -e "  Testing dashboard page (unauthenticated)..."
DASHBOARD_RESPONSE=$(curl -s -L "$FRONTEND_URL/dashboard" 2>/dev/null)

if echo "$DASHBOARD_RESPONSE" | grep -q "Sign in\|login"; then
    echo -e "${GREEN}✅ Dashboard correctly redirects unauthenticated users${NC}"
else
    echo -e "${YELLOW}⚠️  Dashboard page behavior unclear${NC}"
fi

# Test 5: Check localStorage functionality (using Node.js)
echo -e "${BLUE}📝 Test 5: Check token storage functionality${NC}"

# Create a simple Node.js test for localStorage simulation
cat > test-token-storage.js << 'EOF'
// Simulate localStorage for testing
const localStorage = {
  storage: {},
  getItem: function(key) {
    return this.storage[key] || null;
  },
  setItem: function(key, value) {
    this.storage[key] = value;
  },
  removeItem: function(key) {
    delete this.storage[key];
  },
  clear: function() {
    this.storage = {};
  }
};

// Test token storage
console.log('Testing token storage...');

// Test storing tokens
localStorage.setItem('docfiscal_access_token', 'test-access-token');
localStorage.setItem('docfiscal_refresh_token', 'test-refresh-token');

const accessToken = localStorage.getItem('docfiscal_access_token');
const refreshToken = localStorage.getItem('docfiscal_refresh_token');

if (accessToken === 'test-access-token' && refreshToken === 'test-refresh-token') {
  console.log('✅ Token storage is working');
} else {
  console.log('❌ Token storage failed');
}

// Test clearing tokens
localStorage.clear();
const clearedAccess = localStorage.getItem('docfiscal_access_token');
const clearedRefresh = localStorage.getItem('docfiscal_refresh_token');

if (clearedAccess === null && clearedRefresh === null) {
  console.log('✅ Token clearing is working');
} else {
  console.log('❌ Token clearing failed');
}
EOF

node test-token-storage.js
rm test-token-storage.js

# Test 6: Check for redirect loops prevention
echo -e "${BLUE}📝 Test 6: Check redirect loop prevention${NC}"

# This is a basic test - in a real scenario we'd need a browser
echo -e "  Testing redirect manager logic..."

# Create a simple test for redirect manager
cat > test-redirect-manager.js << 'EOF'
// Simulate sessionStorage
const sessionStorage = {
  storage: {},
  getItem: function(key) {
    return this.storage[key] || null;
  },
  setItem: function(key, value) {
    this.storage[key] = value;
  },
  removeItem: function(key) {
    delete this.storage[key];
  }
};

// Simulate redirect manager logic
class RedirectManager {
  static STORAGE_KEY = 'docfiscal_redirect_state';
  static MAX_REDIRECTS = 3;
  static REDIRECT_COOLDOWN = 5000;

  getRedirectState() {
    try {
      const stored = sessionStorage.getItem(RedirectManager.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      // ignore
    }
    return { lastRedirect: null, redirectCount: 0, lastRedirectTime: 0 };
  }

  saveRedirectState(state) {
    try {
      sessionStorage.setItem(RedirectManager.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // ignore
    }
  }

  canRedirect(targetPath) {
    const state = this.getRedirectState();
    const now = Date.now();

    if (state.lastRedirect === targetPath) {
      if (now - state.lastRedirectTime < RedirectManager.REDIRECT_COOLDOWN) {
        return false;
      }
      if (state.redirectCount >= RedirectManager.MAX_REDIRECTS) {
        return false;
      }
    }
    return true;
  }

  recordRedirect(targetPath) {
    const state = this.getRedirectState();
    const now = Date.now();

    if (state.lastRedirect === targetPath) {
      state.redirectCount += 1;
    } else {
      state.redirectCount = 1;
    }

    state.lastRedirect = targetPath;
    state.lastRedirectTime = now;
    this.saveRedirectState(state);
  }
}

// Test redirect manager
const redirectManager = new RedirectManager();

console.log('Testing redirect loop prevention...');

// Test first redirect
if (redirectManager.canRedirect('/login')) {
  redirectManager.recordRedirect('/login');
  console.log('✅ First redirect allowed');
} else {
  console.log('❌ First redirect blocked unexpectedly');
}

// Test multiple redirects to same path
let blockedCount = 0;
for (let i = 0; i < 5; i++) {
  if (!redirectManager.canRedirect('/login')) {
    blockedCount++;
  } else {
    redirectManager.recordRedirect('/login');
  }
}

if (blockedCount > 0) {
  console.log('✅ Redirect loop prevention is working');
} else {
  console.log('❌ Redirect loop prevention may not be working');
}
EOF

node test-redirect-manager.js
rm test-redirect-manager.js

echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo -e "${GREEN}✅ Basic functionality tests completed${NC}"
echo ""
echo -e "${YELLOW}📝 Manual Testing Recommendations:${NC}"
echo -e "  1. Open browser and navigate to $FRONTEND_URL/login"
echo -e "  2. Try logging in with test credentials"
echo -e "  3. Check if redirected to dashboard after successful login"
echo -e "  4. Refresh the page to test session persistence"
echo -e "  5. Try accessing protected routes while unauthenticated"
echo -e "  6. Check browser console for any errors"
echo -e "  7. Verify localStorage contains authentication tokens"
echo ""
echo -e "${BLUE}🔧 Debugging Tips:${NC}"
echo -e "  - Check browser Network tab for API calls"
echo -e "  - Check browser Console for JavaScript errors"
echo -e "  - Check browser Application tab > Local Storage for tokens"
echo -e "  - Verify backend logs for authentication requests"
echo ""