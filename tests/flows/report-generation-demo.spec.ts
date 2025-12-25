import { test, expect } from '@playwright/test';
import { createReportGenerator } from '../helpers/report-generator';
import { createNetworkLogger } from '../helpers/network-logger';
import { createErrorReporter } from '../helpers/error-reporter';
import * as path from 'path';

/**
 * Report Generation Demo Test
 * Demonstrates the comprehensive reporting capabilities
 * Generates sample reports with mock data for testing
 * 
 * Requirements: 9.1, 9.4
 */
test.describe('Report Generation System', () => {
  test('generate comprehensive HTML and JSON reports', async ({ page }) => {
    console.log('🧪 Testing report generation system');

    // Initialize report generator and helpers
    const reportGenerator = createReportGenerator();
    const networkLogger = createNetworkLogger();
    const errorReporter = createErrorReporter();

    // Set up network monitoring
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('report-generation-demo', 'setup');

    // Set test metadata
    reportGenerator.setMetadata({
      startTime: new Date(Date.now() - 60000), // 1 minute ago
      endTime: new Date(),
      duration: 60000,
      browser: 'chromium',
      environment: 'test',
      testCommand: 'npx playwright test --reporter=./tests/helpers/playwright-reporter.ts',
      gitCommit: 'abc123def456',
      buildNumber: '42'
    });

    // Simulate some test execution with network errors
    console.log('📊 Simulating test execution with various scenarios');

    // Navigate to different pages to generate realistic test data
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to access a protected page (should generate auth errors)
    try {
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
    } catch (error) {
      console.log('Expected auth error when accessing protected page');
    }

    // Try login flow
    networkLogger.setFlowContext('report-generation-demo', 'login-test');
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill invalid credentials to generate auth errors
    await page.fill('#email', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Try upload page
    networkLogger.setFlowContext('report-generation-demo', 'upload-test');
    await page.goto('/upload');
    await page.waitForTimeout(2000);

    // Add mock test results to demonstrate reporting
    const mockTestResults = [
      {
        title: 'Authentication Flow - Login Success',
        status: 'passed' as const,
        duration: 5000,
        error: undefined,
        attachments: []
      },
      {
        title: 'Authentication Flow - Invalid Credentials',
        status: 'failed' as const,
        duration: 3000,
        error: { message: 'Login failed with invalid credentials' },
        attachments: []
      },
      {
        title: 'File Upload Flow - Valid PDF',
        status: 'passed' as const,
        duration: 8000,
        error: undefined,
        attachments: []
      },
      {
        title: 'Payment Flow - Payment Processing',
        status: 'passed' as const,
        duration: 12000,
        error: undefined,
        attachments: []
      },
      {
        title: 'Dashboard Navigation - Order History',
        status: 'passed' as const,
        duration: 2000,
        error: undefined,
        attachments: []
      },
      {
        title: 'Download Flow - File Download',
        status: 'skipped' as const,
        duration: 0,
        error: undefined,
        attachments: []
      }
    ];

    // Add test results to report generator
    mockTestResults.forEach(result => {
      reportGenerator.addTestResult(result as any);
    });

    // Add mock UI element tests
    const mockUITests = [
      {
        element: 'Login Button',
        page: '/login',
        selector: 'button[type="submit"]',
        expectedBehavior: 'Should submit login form',
        actualResult: 'working' as const,
        error: undefined,
        screenshot: undefined
      },
      {
        element: 'Upload Area',
        page: '/upload',
        selector: '.upload-area',
        expectedBehavior: 'Should accept PDF files',
        actualResult: 'working' as const,
        error: undefined,
        screenshot: undefined
      },
      {
        element: 'Dashboard Sidebar',
        page: '/dashboard',
        selector: '.sidebar',
        expectedBehavior: 'Should display navigation menu',
        actualResult: 'broken' as const,
        error: 'Sidebar not visible for unauthenticated users',
        screenshot: undefined
      }
    ];

    mockUITests.forEach(test => {
      reportGenerator.addUIElementTest(test);
    });

    // Add mock flow results
    const mockFlowResults = [
      {
        flowName: 'authentication-flow',
        status: 'passed' as const,
        duration: 8000,
        steps: [
          { name: 'Navigate to login', status: 'passed' as const, duration: 1000, error: undefined },
          { name: 'Fill credentials', status: 'passed' as const, duration: 500, error: undefined },
          { name: 'Submit form', status: 'passed' as const, duration: 2000, error: undefined },
          { name: 'Verify redirect', status: 'passed' as const, duration: 1000, error: undefined }
        ],
        errors: [],
        evidence: [],
        metadata: {
          browser: 'chromium',
          viewport: '1920x1080',
          timestamp: new Date()
        }
      },
      {
        flowName: 'file-upload-flow',
        status: 'failed' as const,
        duration: 15000,
        steps: [
          { name: 'Navigate to upload', status: 'passed' as const, duration: 1000, error: undefined },
          { name: 'Select file', status: 'passed' as const, duration: 500, error: undefined },
          { name: 'Upload file', status: 'failed' as const, duration: 10000, error: 'Upload timeout' },
          { name: 'Verify upload', status: 'skipped' as const, duration: 0, error: undefined }
        ],
        errors: networkLogger.getErrors(),
        evidence: [
          {
            type: 'screenshot' as const,
            data: 'mock-screenshot-path.png',
            timestamp: new Date(),
            description: 'Upload failure screenshot'
          }
        ],
        metadata: {
          browser: 'chromium',
          viewport: '1920x1080',
          timestamp: new Date()
        }
      }
    ];

    mockFlowResults.forEach(result => {
      reportGenerator.addFlowResult(result);
    });

    // Get captured network errors
    const capturedErrors = networkLogger.getErrors();
    reportGenerator.addNetworkErrors(capturedErrors);

    // Generate comprehensive report
    console.log('📋 Generating comprehensive test report');
    const comprehensiveReport = reportGenerator.generateComprehensiveReport();

    // Validate report structure
    expect(comprehensiveReport).toHaveProperty('metadata');
    expect(comprehensiveReport).toHaveProperty('summary');
    expect(comprehensiveReport).toHaveProperty('errorAnalysis');
    expect(comprehensiveReport).toHaveProperty('bugReports');
    expect(comprehensiveReport).toHaveProperty('flowCoverage');
    expect(comprehensiveReport).toHaveProperty('performance');
    expect(comprehensiveReport).toHaveProperty('recommendations');

    // Validate summary data
    expect(comprehensiveReport.summary.totalTests).toBe(mockTestResults.length);
    expect(comprehensiveReport.summary.passedTests).toBe(4);
    expect(comprehensiveReport.summary.failedTests).toBe(1);
    expect(comprehensiveReport.summary.skippedTests).toBe(1);

    // Export reports to files
    const reportsDir = path.join(process.cwd(), 'tests', 'reports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const jsonPath = path.join(reportsDir, 'json', `demo-report-${timestamp}.json`);
    const htmlPath = path.join(reportsDir, 'html', `demo-report-${timestamp}.html`);

    console.log('💾 Exporting reports to files');
    reportGenerator.exportToJson(comprehensiveReport, jsonPath);
    reportGenerator.exportToHtml(comprehensiveReport, htmlPath);

    // Validate files were created
    const fs = require('fs');
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);

    // Validate JSON report content
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const parsedReport = JSON.parse(jsonContent);
    expect(parsedReport.summary.totalTests).toBe(mockTestResults.length);

    // Validate HTML report content
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('DocFiscal E2E Test Report');
    expect(htmlContent).toContain('Test Results Analysis');
    expect(htmlContent).toContain('Flow Coverage');

    // Generate summary report
    console.log('📄 Generating summary report');
    const summaryReport = reportGenerator.generateSummaryReport();
    expect(summaryReport).toContain('E2E Test Summary Report');
    expect(summaryReport).toContain('Test Results');
    expect(summaryReport).toContain('Issues Found');
    expect(summaryReport).toContain('Coverage');

    console.log('✅ Report generation test completed successfully');
    console.log(`📊 Generated reports:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   HTML: ${htmlPath}`);
    
    // Log key metrics
    console.log(`📈 Report metrics:`);
    console.log(`   Total Tests: ${comprehensiveReport.summary.totalTests}`);
    console.log(`   Success Rate: ${comprehensiveReport.summary.successRate.toFixed(1)}%`);
    console.log(`   Flow Coverage: ${comprehensiveReport.flowCoverage.coverage.toFixed(1)}%`);
    console.log(`   Bug Reports: ${comprehensiveReport.bugReports.length}`);
    console.log(`   Recommendations: ${comprehensiveReport.recommendations.length}`);
  });

  test('validate error analysis and bug report generation', async ({ page }) => {
    console.log('🔍 Testing error analysis and bug report generation');

    const reportGenerator = createReportGenerator();
    const networkLogger = createNetworkLogger();

    // Create mock network errors for testing
    const mockNetworkErrors = [
      {
        id: 'error-1',
        timestamp: new Date(),
        flow: 'authentication-flow',
        step: 'login-attempt',
        request: {
          url: 'http://localhost:8000/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { email: 'test@example.com', password: 'password' }
        },
        response: {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Invalid credentials' }
        },
        category: 'client' as const,
        severity: 'high' as const
      },
      {
        id: 'error-2',
        timestamp: new Date(),
        flow: 'file-upload-flow',
        step: 'file-upload',
        request: {
          url: 'http://localhost:8000/api/orders',
          method: 'POST',
          headers: { 'Content-Type': 'multipart/form-data' },
          body: null
        },
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'application/json' },
          body: { error: 'Database connection failed' }
        },
        category: 'server' as const,
        severity: 'critical' as const
      }
    ];

    // Add network errors
    reportGenerator.addNetworkErrors(mockNetworkErrors);

    // Add mock failed test
    reportGenerator.addTestResult({
      title: 'Critical Payment Flow Test',
      status: 'failed',
      duration: 10000,
      error: { message: 'Payment processing failed due to server error' },
      attachments: []
    } as any);

    // Generate report
    const report = reportGenerator.generateComprehensiveReport();

    // Validate error analysis
    expect(report.errorAnalysis.summary.totalErrors).toBe(2);
    expect(report.errorAnalysis.summary.criticalErrors).toBe(1);

    // Validate bug reports were generated
    expect(report.bugReports.length).toBeGreaterThan(0);
    
    const criticalBugs = report.bugReports.filter(bug => bug.severity === 'critical');
    expect(criticalBugs.length).toBeGreaterThan(0);

    // Validate bug report structure
    const firstBug = report.bugReports[0];
    expect(firstBug).toHaveProperty('id');
    expect(firstBug).toHaveProperty('title');
    expect(firstBug).toHaveProperty('severity');
    expect(firstBug).toHaveProperty('description');
    expect(firstBug).toHaveProperty('stepsToReproduce');
    expect(firstBug).toHaveProperty('expectedBehavior');
    expect(firstBug).toHaveProperty('actualBehavior');
    expect(firstBug).toHaveProperty('evidence');
    expect(firstBug).toHaveProperty('affectedFlows');

    // Validate recommendations include critical error warnings
    const hasCriticalWarning = report.recommendations.some(rec => 
      rec.includes('CRITICAL') || rec.includes('critical')
    );
    expect(hasCriticalWarning).toBe(true);

    console.log('✅ Error analysis and bug report generation validated');
    console.log(`🐛 Generated ${report.bugReports.length} bug reports`);
    console.log(`⚠️  Found ${report.errorAnalysis.summary.criticalErrors} critical errors`);
  });

  test('validate CI/CD integration report format', async ({ page }) => {
    console.log('🔄 Testing CI/CD integration report format');

    const reportGenerator = createReportGenerator();

    // Add sample test data
    reportGenerator.addTestResult({
      title: 'Sample Test 1',
      status: 'passed',
      duration: 5000,
      error: undefined,
      attachments: []
    } as any);

    reportGenerator.addTestResult({
      title: 'Sample Test 2',
      status: 'failed',
      duration: 3000,
      error: { message: 'Test failed' },
      attachments: []
    } as any);

    // Generate summary report for CI/CD
    const summaryReport = reportGenerator.generateSummaryReport();

    // Validate summary report format
    expect(summaryReport).toContain('# E2E Test Summary Report');
    expect(summaryReport).toContain('## 📊 Test Results');
    expect(summaryReport).toContain('## 🐛 Issues Found');
    expect(summaryReport).toContain('## 📈 Coverage');
    expect(summaryReport).toContain('## 🎯 Key Recommendations');

    // Validate markdown formatting
    expect(summaryReport).toContain('**Total Tests**:');
    expect(summaryReport).toContain('**Passed**:');
    expect(summaryReport).toContain('**Failed**:');
    expect(summaryReport).toContain('**Success Rate**:');

    // Validate data accuracy
    expect(summaryReport).toContain('Total Tests**: 2');
    expect(summaryReport).toContain('Passed**: 1');
    expect(summaryReport).toContain('Failed**: 1');
    expect(summaryReport).toContain('Success Rate**: 50.0%');

    console.log('✅ CI/CD integration report format validated');
    console.log('📋 Summary report generated for CI/CD pipeline');
  });
});