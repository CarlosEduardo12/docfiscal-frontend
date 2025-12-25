import { test, expect } from '@playwright/test';
import { ErrorReporter, FlowResult, UIElementTest, Evidence } from './error-reporter';
import { NetworkError } from './network-logger';

/**
 * Property test for comprehensive error reporting structure
 * **Feature: e2e-flow-testing, Property 5: Comprehensive Error Reporting**
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */

// Helper function to generate random network errors
function generateRandomNetworkError(overrides: Partial<NetworkError> = {}): NetworkError {
  const statuses = [400, 401, 403, 404, 422, 500, 502, 503, 504];
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const endpoints = ['/api/auth/login', '/api/orders', '/api/payments', '/api/upload'];
  const flows = ['auth-flow', 'upload-flow', 'payment-flow', 'dashboard-flow'];
  
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  const randomMethod = methods[Math.floor(Math.random() * methods.length)];
  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const randomFlow = flows[Math.floor(Math.random() * flows.length)];
  
  return {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      body: { error: 'Test error message' }
    },
    category: randomStatus >= 500 ? 'server' : 'client',
    severity: randomStatus >= 500 ? 'high' : 'medium',
    ...overrides
  };
}

// Helper function to generate random flow results
function generateRandomFlowResult(overrides: Partial<FlowResult> = {}): FlowResult {
  const flowNames = ['auth-flow', 'upload-flow', 'payment-flow', 'dashboard-flow'];
  const statuses: ('passed' | 'failed' | 'skipped')[] = ['passed', 'failed', 'skipped'];
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  const randomFlowName = flowNames[Math.floor(Math.random() * flowNames.length)];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  const randomBrowser = browsers[Math.floor(Math.random() * browsers.length)];
  
  return {
    flowName: randomFlowName,
    status: randomStatus,
    duration: Math.floor(Math.random() * 5000) + 1000,
    steps: [
      {
        name: 'step-1',
        status: 'passed',
        duration: Math.floor(Math.random() * 1000) + 100
      },
      {
        name: 'step-2', 
        status: randomStatus === 'failed' ? 'failed' : 'passed',
        duration: Math.floor(Math.random() * 1000) + 100,
        error: randomStatus === 'failed' ? 'Test error' : undefined
      }
    ],
    errors: [],
    evidence: [],
    metadata: {
      browser: randomBrowser,
      viewport: '1920x1080',
      timestamp: new Date()
    },
    ...overrides
  };
}

// Helper function to generate random UI element tests
function generateRandomUIElementTest(overrides: Partial<UIElementTest> = {}): UIElementTest {
  const elements = ['login-button', 'upload-area', 'payment-form', 'order-table'];
  const pages = ['login', 'upload', 'payment', 'dashboard'];
  const selectors = ['[data-testid="login-btn"]', '[data-testid="upload"]', '#payment-form', '.order-table'];
  const results: ('working' | 'broken' | 'not_tested')[] = ['working', 'broken', 'not_tested'];
  
  const randomElement = elements[Math.floor(Math.random() * elements.length)];
  const randomPage = pages[Math.floor(Math.random() * pages.length)];
  const randomSelector = selectors[Math.floor(Math.random() * selectors.length)];
  const randomResult = results[Math.floor(Math.random() * results.length)];
  
  return {
    element: randomElement,
    page: randomPage,
    selector: randomSelector,
    expectedBehavior: 'Should be clickable and functional',
    actualResult: randomResult,
    error: randomResult === 'broken' ? 'Element not found or not clickable' : undefined,
    ...overrides
  };
}

test.describe('Error Reporting Structure Property Tests', () => {
  test('Property 5: For any collection of network errors and flow results, the generated report should contain structured error categorization by endpoint, method, and error type, along with actionable debugging information', async () => {
    // Run this property test multiple times with different random inputs
    for (let iteration = 0; iteration < 100; iteration++) {
      const reporter = new ErrorReporter();
      
      // Generate random test data
      const numErrors = Math.floor(Math.random() * 10) + 1; // 1-10 errors
      const numFlows = Math.floor(Math.random() * 5) + 1; // 1-5 flows
      const numUIElements = Math.floor(Math.random() * 8) + 1; // 1-8 UI elements
      
      const errors: NetworkError[] = [];
      for (let i = 0; i < numErrors; i++) {
        errors.push(generateRandomNetworkError());
      }
      
      const flowResults: FlowResult[] = [];
      for (let i = 0; i < numFlows; i++) {
        const flowResult = generateRandomFlowResult();
        flowResults.push(flowResult);
        reporter.addFlowResult(flowResult);
      }
      
      const uiElementTests: UIElementTest[] = [];
      for (let i = 0; i < numUIElements; i++) {
        const uiTest = generateRandomUIElementTest();
        uiElementTests.push(uiTest);
        reporter.addUIElementTest(uiTest);
      }
      
      // Generate the report
      const report = reporter.generateReport(errors);
      
      // Verify report structure exists and is complete
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.errors).toBeDefined();
      expect(report.evidence).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.uiElements).toBeDefined();
      expect(report.flowCoverage).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      
      // Verify summary contains all required fields
      expect(report.summary.totalTests).toBe(numFlows);
      expect(report.summary.totalErrors).toBe(numErrors);
      expect(report.summary.passedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.failedTests).toBeGreaterThanOrEqual(0);
      expect(report.summary.criticalErrors).toBeGreaterThanOrEqual(0);
      expect(report.summary.executionTime).toBeGreaterThanOrEqual(0);
      expect(report.summary.timestamp).toBeInstanceOf(Date);
      
      // Verify error categorization structure
      expect(report.errors.byEndpoint).toBeDefined();
      expect(report.errors.byType).toBeDefined();
      expect(report.errors.byFlow).toBeDefined();
      expect(report.errors.bySeverity).toBeDefined();
      
      // Verify all errors are properly categorized
      const totalCategorizedErrors = Object.values(report.errors.byEndpoint)
        .reduce((sum, endpointErrors) => sum + endpointErrors.length, 0);
      expect(totalCategorizedErrors).toBe(numErrors);
      
      // Verify error categorization by type (4xx, 5xx)
      const errorTypes = Object.keys(report.errors.byType);
      errorTypes.forEach(type => {
        expect(['4xx', '5xx'].includes(type)).toBe(true);
        expect(report.errors.byType[type]).toBeInstanceOf(Array);
        expect(report.errors.byType[type].length).toBeGreaterThan(0);
      });
      
      // Verify error categorization by severity
      const severityTypes = Object.keys(report.errors.bySeverity);
      severityTypes.forEach(severity => {
        expect(['low', 'medium', 'high', 'critical'].includes(severity)).toBe(true);
        expect(report.errors.bySeverity[severity]).toBeInstanceOf(Array);
        expect(report.errors.bySeverity[severity].length).toBeGreaterThan(0);
      });
      
      // Verify recommendations are actionable (contain specific guidance)
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
      report.recommendations.forEach(recommendation => {
        expect(typeof recommendation).toBe('string');
        expect(recommendation.length).toBeGreaterThan(10); // Should be meaningful
        
        // Should contain actionable keywords OR be informational/success message
        const actionableKeywords = ['check', 'verify', 'review', 'fix', 'investigate', 'detected', 'needs'];
        const informationalKeywords = ['no backend errors', 'all api endpoints', 'responding correctly', 'total of', 'errors detected'];
        
        const hasActionableKeyword = actionableKeywords.some(keyword => 
          recommendation.toLowerCase().includes(keyword)
        );
        const isInformationalMessage = informationalKeywords.some(keyword => 
          recommendation.toLowerCase().includes(keyword)
        );
        
        expect(hasActionableKeyword || isInformationalMessage).toBe(true);
      });
      
      // Verify UI elements are properly tracked
      expect(report.uiElements.length).toBe(numUIElements);
      report.uiElements.forEach(element => {
        expect(element.element).toBeDefined();
        expect(element.page).toBeDefined();
        expect(element.selector).toBeDefined();
        expect(['working', 'broken', 'not_tested'].includes(element.status)).toBe(true);
        expect(element.timestamp).toBeInstanceOf(Date);
      });
      
      // Verify flow coverage is calculated correctly
      expect(report.flowCoverage.totalFlows).toBe(numFlows);
      expect(report.flowCoverage.testedFlows).toBeGreaterThanOrEqual(0);
      expect(report.flowCoverage.testedFlows).toBeLessThanOrEqual(numFlows);
      expect(report.flowCoverage.passedFlows).toBeGreaterThanOrEqual(0);
      expect(report.flowCoverage.failedFlows).toBeGreaterThanOrEqual(0);
      expect(report.flowCoverage.coverage).toBeGreaterThanOrEqual(0);
      expect(report.flowCoverage.coverage).toBeLessThanOrEqual(100);
      expect(report.flowCoverage.flowDetails.length).toBe(numFlows);
      
      // Verify flow details contain required information
      report.flowCoverage.flowDetails.forEach(flow => {
        expect(flow.name).toBeDefined();
        expect(['passed', 'failed', 'skipped'].includes(flow.status)).toBe(true);
        expect(flow.duration).toBeGreaterThanOrEqual(0);
        expect(flow.steps).toBeGreaterThanOrEqual(0);
        expect(flow.errors).toBeGreaterThanOrEqual(0);
        expect(flow.lastRun).toBeInstanceOf(Date);
      });
      
      // Verify report can be exported to JSON
      const jsonReport = reporter.exportToJson(report);
      expect(typeof jsonReport).toBe('string');
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      const parsedReport = JSON.parse(jsonReport);
      expect(parsedReport.summary).toBeDefined();
      expect(parsedReport.errors).toBeDefined();
      
      // Verify report can be exported to HTML
      const htmlReport = reporter.exportToHtml(report);
      expect(typeof htmlReport).toBe('string');
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('E2E Flow Testing Report');
      expect(htmlReport).toContain(report.summary.totalErrors.toString());
      expect(htmlReport).toContain(report.summary.totalTests.toString());
    }
  });
  
  test('Property 5 Edge Case: Empty inputs should generate valid report structure', async () => {
    const reporter = new ErrorReporter();
    
    // Generate report with no errors, flows, or UI elements
    const report = reporter.generateReport([]);
    
    // Should still have valid structure
    expect(report).toBeDefined();
    expect(report.summary.totalTests).toBe(0);
    expect(report.summary.totalErrors).toBe(0);
    expect(report.summary.passedTests).toBe(0);
    expect(report.summary.failedTests).toBe(0);
    expect(report.summary.criticalErrors).toBe(0);
    
    // Should have empty but valid categorization
    expect(Object.keys(report.errors.byEndpoint)).toHaveLength(0);
    expect(Object.keys(report.errors.byType)).toHaveLength(0);
    expect(Object.keys(report.errors.byFlow)).toHaveLength(0);
    expect(Object.keys(report.errors.bySeverity)).toHaveLength(0);
    
    // Should still have recommendations (at least success message)
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toContain('No backend errors detected');
    
    // Should export successfully
    const jsonReport = reporter.exportToJson(report);
    expect(() => JSON.parse(jsonReport)).not.toThrow();
    
    const htmlReport = reporter.exportToHtml(report);
    expect(htmlReport).toContain('E2E Flow Testing Report');
  });
  
  test('Property 5 Edge Case: Single error should be properly categorized', async () => {
    const reporter = new ErrorReporter();
    
    // Generate single error
    const singleError = generateRandomNetworkError({
      response: { 
        status: 500, 
        statusText: 'Internal Server Error',
        headers: {},
        body: { error: 'Database connection failed' }
      },
      category: 'server',
      severity: 'critical'
    });
    
    const report = reporter.generateReport([singleError]);
    
    // Should properly categorize single error
    expect(report.summary.totalErrors).toBe(1);
    expect(report.summary.criticalErrors).toBe(1);
    
    // Should appear in all relevant categories
    expect(Object.values(report.errors.byEndpoint).flat()).toHaveLength(1);
    expect(Object.values(report.errors.byType).flat()).toHaveLength(1);
    expect(Object.values(report.errors.byFlow).flat()).toHaveLength(1);
    expect(Object.values(report.errors.bySeverity).flat()).toHaveLength(1);
    
    // Should have critical error recommendation
    const criticalRecommendation = report.recommendations.find(rec => 
      rec.includes('CRITICAL') && rec.includes('1 critical errors')
    );
    expect(criticalRecommendation).toBeDefined();
  });
});