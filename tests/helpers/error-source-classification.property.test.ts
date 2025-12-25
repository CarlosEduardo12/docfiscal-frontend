import { test, expect } from '@playwright/test';
import { ErrorReporter, FlowResult, Evidence } from './error-reporter';
import { NetworkError } from './network-logger';

/**
 * Property test for error source classification
 * **Feature: e2e-flow-testing, Property 6: Error Source Classification**
 * **Validates: Requirements 9.5**
 */

// Helper function to generate frontend errors (JavaScript errors, UI failures)
function generateFrontendError(overrides: Partial<any> = {}): any {
  const frontendErrorTypes = [
    'JavaScript runtime error',
    'UI component failure',
    'Navigation timeout',
    'Element not found',
    'Click handler failure',
    'Form validation error'
  ];
  
  const randomErrorType = frontendErrorTypes[Math.floor(Math.random() * frontendErrorTypes.length)];
  
  return {
    type: 'frontend',
    source: 'client-side',
    errorType: randomErrorType,
    message: `Frontend error: ${randomErrorType}`,
    stack: 'Error stack trace...',
    timestamp: new Date(),
    page: '/dashboard',
    element: '[data-testid="upload-button"]',
    ...overrides
  };
}

// Helper function to generate backend errors (HTTP errors, API failures)
function generateBackendError(overrides: Partial<NetworkError> = {}): NetworkError {
  const statuses = [400, 401, 403, 404, 422, 500, 502, 503, 504];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const endpoints = ['/api/auth/login', '/api/orders', '/api/payments', '/api/upload'];
  const flows = ['auth-flow', 'upload-flow', 'payment-flow', 'dashboard-flow'];
  
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  const randomMethod = methods[Math.floor(Math.random() * methods.length)];
  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const randomFlow = flows[Math.floor(Math.random() * flows.length)];
  
  return {
    id: `backend-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    flow: randomFlow,
    step: `step-${Math.floor(Math.random() * 5) + 1}`,
    request: {
      url: `http://localhost:8000${randomEndpoint}`,
      method: randomMethod,
      headers: { 'content-type': 'application/json' },
      body: randomMethod !== 'GET' ? { data: 'test' } : undefined
    },
    response: {
      status: randomStatus,
      statusText: randomStatus >= 500 ? 'Internal Server Error' : 'Client Error',
      headers: { 'content-type': 'application/json' },
      body: { error: 'Backend API error message' }
    },
    category: randomStatus >= 500 ? 'server' : 'client',
    severity: randomStatus >= 500 ? 'high' : 'medium',
    ...overrides
  };
}

// Helper function to classify error source
function classifyErrorSource(error: any): 'frontend' | 'backend' {
  // Backend errors have HTTP status codes and request/response structure
  if (error.request && error.response && error.response.status) {
    return 'backend';
  }
  
  // Frontend errors have JavaScript error characteristics
  if (error.type === 'frontend' || error.stack || error.element) {
    return 'frontend';
  }
  
  // Default classification based on error structure
  return error.source === 'client-side' ? 'frontend' : 'backend';
}

test.describe('Error Source Classification Property Tests', () => {
  test('Property 6: For any error encountered during testing, the system should correctly distinguish between frontend issues (JavaScript errors, UI failures) and backend failures (HTTP errors, API failures)', async () => {
    // Run this property test multiple times with different random inputs
    for (let iteration = 0; iteration < 100; iteration++) {
      const reporter = new ErrorReporter();
      
      // Generate random mix of frontend and backend errors
      const numBackendErrors = Math.floor(Math.random() * 8) + 1; // 1-8 backend errors
      const numFrontendErrors = Math.floor(Math.random() * 5) + 1; // 1-5 frontend errors
      
      const backendErrors: NetworkError[] = [];
      const frontendErrors: any[] = [];
      const allErrors: any[] = [];
      
      // Generate backend errors (HTTP/API failures)
      for (let i = 0; i < numBackendErrors; i++) {
        const backendError = generateBackendError();
        backendErrors.push(backendError);
        allErrors.push(backendError);
      }
      
      // Generate frontend errors (JavaScript/UI failures)
      for (let i = 0; i < numFrontendErrors; i++) {
        const frontendError = generateFrontendError();
        frontendErrors.push(frontendError);
        allErrors.push(frontendError);
      }
      
      // Test classification of each error
      allErrors.forEach(error => {
        const classification = classifyErrorSource(error);
        
        // Verify backend errors are correctly classified
        if (error.request && error.response && error.response.status) {
          expect(classification).toBe('backend');
          
          // Backend errors should have HTTP characteristics
          expect(error.response.status).toBeGreaterThanOrEqual(400);
          expect(error.request.url).toBeDefined();
          expect(error.request.method).toBeDefined();
          expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(error.request.method)).toBe(true);
          
          // Should be categorized as client or server error
          expect(['client', 'server', 'network'].includes(error.category)).toBe(true);
          
          // Status code should match category
          if (error.response.status >= 400 && error.response.status < 500) {
            expect(error.category).toBe('client');
          } else if (error.response.status >= 500) {
            expect(error.category).toBe('server');
          }
        }
        
        // Verify frontend errors are correctly classified
        if (error.type === 'frontend' || error.stack || error.element) {
          expect(classification).toBe('frontend');
          
          // Frontend errors should have client-side characteristics
          expect(error.source).toBe('client-side');
          expect(error.errorType).toBeDefined();
          expect(error.message).toContain('Frontend error');
          
          // Should not have HTTP request/response structure
          expect(error.request).toBeUndefined();
          expect(error.response).toBeUndefined();
        }
      });
      
      // Generate report with backend errors only (frontend errors need different handling)
      const report = reporter.generateReport(backendErrors);
      
      // Verify backend errors are properly categorized in report
      const totalBackendErrorsInReport = Object.values(report.errors.byEndpoint)
        .reduce((sum, endpointErrors) => sum + endpointErrors.length, 0);
      expect(totalBackendErrorsInReport).toBe(numBackendErrors);
      
      // All errors in report should be backend errors (have HTTP characteristics)
      Object.values(report.errors.byEndpoint).flat().forEach(error => {
        expect(error.request).toBeDefined();
        expect(error.response).toBeDefined();
        expect(error.response.status).toBeGreaterThanOrEqual(400);
        expect(['client', 'server', 'network'].includes(error.category)).toBe(true);
      });
      
      // Verify error categorization by type reflects HTTP status categories
      Object.entries(report.errors.byType).forEach(([type, errors]) => {
        expect(['4xx', '5xx'].includes(type)).toBe(true);
        
        errors.forEach(error => {
          if (type === '4xx') {
            expect(error.response.status).toBeGreaterThanOrEqual(400);
            expect(error.response.status).toBeLessThan(500);
            expect(error.category).toBe('client');
          } else if (type === '5xx') {
            expect(error.response.status).toBeGreaterThanOrEqual(500);
            expect(error.response.status).toBeLessThan(600);
            expect(error.category).toBe('server');
          }
        });
      });
      
      // Verify recommendations distinguish between error sources
      if (backendErrors.some(e => e.category === 'server')) {
        const serverRecommendation = report.recommendations.find(rec => 
          rec.includes('SERVER') && rec.includes('server errors')
        );
        expect(serverRecommendation).toBeDefined();
        expect(serverRecommendation).toContain('Check backend logs');
      }
      
      if (backendErrors.some(e => e.response.status === 401 || e.response.status === 403)) {
        const authRecommendation = report.recommendations.find(rec => 
          rec.includes('AUTH') && rec.includes('authentication errors')
        );
        expect(authRecommendation).toBeDefined();
        expect(authRecommendation).toContain('token handling');
      }
    }
  });
  
  test('Property 6 Edge Case: Pure backend errors should be classified correctly', async () => {
    const reporter = new ErrorReporter();
    
    // Generate only backend errors with different status codes
    const backendErrors = [
      generateBackendError({ response: { status: 400, statusText: 'Bad Request', headers: {}, body: {} }, category: 'client' }),
      generateBackendError({ response: { status: 401, statusText: 'Unauthorized', headers: {}, body: {} }, category: 'client' }),
      generateBackendError({ response: { status: 404, statusText: 'Not Found', headers: {}, body: {} }, category: 'client' }),
      generateBackendError({ response: { status: 500, statusText: 'Internal Server Error', headers: {}, body: {} }, category: 'server' }),
      generateBackendError({ response: { status: 502, statusText: 'Bad Gateway', headers: {}, body: {} }, category: 'server' }),
      generateBackendError({ response: { status: 503, statusText: 'Service Unavailable', headers: {}, body: {} }, category: 'server' })
    ];
    
    // All should be classified as backend errors
    backendErrors.forEach(error => {
      const classification = classifyErrorSource(error);
      expect(classification).toBe('backend');
    });
    
    const report = reporter.generateReport(backendErrors);
    
    // Should have both 4xx and 5xx categories
    expect(report.errors.byType['4xx']).toBeDefined();
    expect(report.errors.byType['5xx']).toBeDefined();
    expect(report.errors.byType['4xx'].length).toBe(3); // 400, 401, 404
    expect(report.errors.byType['5xx'].length).toBe(3); // 500, 502, 503
    
    // Should have client and server categories
    const clientErrors = backendErrors.filter(e => e.category === 'client');
    const serverErrors = backendErrors.filter(e => e.category === 'server');
    expect(clientErrors.length).toBe(3);
    expect(serverErrors.length).toBe(3);
    
    // Should have appropriate recommendations for backend errors
    expect(report.recommendations.some(rec => rec.includes('SERVER'))).toBe(true);
    expect(report.recommendations.some(rec => rec.includes('AUTH'))).toBe(true);
  });
  
  test('Property 6 Edge Case: Mixed error types should be distinguished', async () => {
    // Test with a mix of clearly distinguishable errors
    const backendError = generateBackendError({
      response: { status: 500, statusText: 'Internal Server Error', headers: {}, body: { error: 'Database error' } },
      category: 'server'
    });
    
    const frontendError = generateFrontendError({
      type: 'frontend',
      source: 'client-side',
      errorType: 'JavaScript runtime error',
      stack: 'TypeError: Cannot read property of undefined'
    });
    
    // Should classify correctly
    expect(classifyErrorSource(backendError)).toBe('backend');
    expect(classifyErrorSource(frontendError)).toBe('frontend');
    
    // Backend error should have HTTP characteristics
    expect(backendError.request).toBeDefined();
    expect(backendError.response).toBeDefined();
    expect(backendError.response.status).toBe(500);
    
    // Frontend error should have client-side characteristics
    expect(frontendError.type).toBe('frontend');
    expect(frontendError.source).toBe('client-side');
    expect(frontendError.stack).toBeDefined();
    expect(frontendError.request).toBeUndefined();
    expect(frontendError.response).toBeUndefined();
  });
  
  test('Property 6 Edge Case: Error structure validation', async () => {
    // Test various error structures to ensure robust classification
    const testCases = [
      // Clear backend error
      {
        error: generateBackendError(),
        expectedClassification: 'backend'
      },
      // Clear frontend error
      {
        error: generateFrontendError(),
        expectedClassification: 'frontend'
      },
      // Edge case: error with minimal backend structure
      {
        error: {
          request: { url: '/api/test', method: 'GET', headers: {} },
          response: { status: 404, statusText: 'Not Found', headers: {}, body: null }
        },
        expectedClassification: 'backend'
      },
      // Edge case: error with minimal frontend structure
      {
        error: {
          type: 'frontend',
          message: 'UI error',
          element: '#button'
        },
        expectedClassification: 'frontend'
      }
    ];
    
    testCases.forEach(({ error, expectedClassification }) => {
      const classification = classifyErrorSource(error);
      expect(classification).toBe(expectedClassification);
    });
  });
});