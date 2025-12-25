# E2E Flow Testing System

This directory contains the comprehensive Playwright-based testing system for the DocFiscal application.

## Directory Structure

```
tests/
├── flows/                          # Business flow tests
│   ├── auth-flow.spec.ts          # Authentication flows
│   ├── landing-page.spec.ts       # Landing page elements
│   ├── upload-conversion.spec.ts  # File upload and conversion
│   ├── payment-flow.spec.ts       # Payment processing
│   ├── dashboard-navigation.spec.ts # Dashboard UI elements
│   ├── order-management.spec.ts   # Order history and actions
│   ├── order-status.spec.ts       # Individual order status
│   ├── download-flow.spec.ts      # File download functionality
│   └── real-time-updates.spec.ts  # Auto-refresh and polling
├── helpers/                        # Reusable test utilities
│   ├── setup.ts                   # Global test setup
│   ├── network-logger.ts          # Network monitoring
│   ├── auth.ts                    # Authentication helpers
│   ├── error-reporter.ts          # Error reporting
│   ├── ui-interactions.ts         # UI interaction helpers
│   └── status-polling.ts          # Status monitoring
├── fixtures/                       # Test data and files
│   ├── test-files/                # Sample files for testing
│   ├── mock-responses/            # Mock API responses
│   └── test-data.json             # Test user data and config
└── reports/                        # Generated test reports
    ├── error-reports/             # Backend error analysis
    ├── flow-reports/              # Flow execution results
    ├── screenshots/               # Failure screenshots
    ├── html/                      # HTML test reports
    ├── json/                      # JSON test results
    └── junit/                     # JUnit XML reports
```

## Running Tests

### Basic Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View test reports
npm run test:e2e:report
```

### Environment Configuration

1. Copy `.env.test.local.example` to `.env.test.local`
2. Update with your local test user credentials
3. Ensure your local development server is running on port 3000
4. Ensure your backend API is running on port 8000

### Test Organization

Tests are organized by business flows rather than UI components:

- **Authentication Flow**: Login, registration, logout
- **File Conversion Flow**: Upload, processing, completion
- **Payment Flow**: Payment creation, monitoring, completion
- **Order Management**: Dashboard, history, status tracking
- **Download Flow**: File download and validation

### Error Detection

The system automatically captures:
- HTTP responses with status ≥ 400
- Network timeouts and connection failures
- JavaScript errors and exceptions
- UI element failures and missing elements

### Reporting

Test reports include:
- Structured error categorization
- Flow execution results
- UI element status tracking
- Evidence collection (screenshots, network logs)
- Actionable debugging information

## Property-Based Testing

Some tests use property-based testing to validate universal properties:
- Error capture completeness
- Report structure consistency
- Test execution reliability
- Debugging information completeness

These tests run with multiple iterations to ensure robustness across different scenarios.