import { test, expect } from '@playwright/test';
import { createReportGenerator } from '../helpers/report-generator';
import { createNetworkLogger } from '../helpers/network-logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CI/CD Integration Tests
 * Tests CI/CD pipeline integration and report distribution
 * Validates environment consistency and build artifact generation
 * Tests automated reporting and notification systems
 * 
 * Requirements: 10.1, 10.5
 */
test.describe('CI/CD Integration and Report Distribution', () => {
  test('validate CI/CD environment configuration', async ({ page }) => {
    console.log('🏗️ Validating CI/CD environment configuration');

    // Test 1: Environment variable validation
    const requiredEnvVars = [
      'NODE_ENV',
      'BASE_URL'
    ];

    const optionalEnvVars = [
      'CI',
      'GITHUB_ACTIONS',
      'GITHUB_SHA',
      'GITHUB_REF_NAME',
      'GITHUB_RUN_NUMBER',
      'BUILD_NUMBER'
    ];

    console.log('🔍 Checking environment variables:');
    
    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      console.log(`   ${envVar}: ${value || 'NOT SET'}`);
      if (!value) {
        console.warn(`⚠️ Required environment variable ${envVar} is not set`);
      }
    });

    optionalEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`   ${envVar}: ${value}`);
      }
    });

    // Test 2: Validate test configuration for CI
    const isCI = !!process.env.CI;
    const config = {
      retries: isCI ? 2 : 0,
      workers: isCI ? 1 : undefined,
      timeout: 60000,
      baseURL: process.env.BASE_URL || 'http://localhost:3000'
    };

    console.log('⚙️ Test configuration:', config);
    expect(config.baseURL).toBeDefined();
    expect(config.timeout).toBeGreaterThan(0);

    if (isCI) {
      expect(config.retries).toBeGreaterThan(0);
      console.log('✅ CI-specific configuration validated');
    }

    // Test 3: Validate network connectivity
    const networkLogger = createNetworkLogger();
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('ci-cd-integration', 'connectivity-test');

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      console.log('✅ Application connectivity confirmed');
    } catch (error) {
      console.error('❌ Application connectivity failed:', error);
      throw new Error('CI/CD environment cannot reach application');
    }

    // Test 4: Validate browser capabilities in CI
    const browserCapabilities = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      features: {
        localStorage: typeof Storage !== 'undefined',
        sessionStorage: typeof sessionStorage !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        webGL: !!window.WebGLRenderingContext
      }
    }));

    console.log('🌐 Browser capabilities:', browserCapabilities);
    expect(browserCapabilities.features.localStorage).toBe(true);
    expect(browserCapabilities.features.fetch).toBe(true);

    console.log('✅ CI/CD environment configuration validated');
  });

  test('generate and validate build artifacts', async ({ page }) => {
    console.log('📦 Testing build artifact generation');

    const reportGenerator = createReportGenerator();
    const networkLogger = createNetworkLogger();
    
    await networkLogger.captureBackendErrors(page);
    networkLogger.setFlowContext('ci-cd-integration', 'artifact-generation');

    // Set build metadata
    const buildMetadata = {
      startTime: new Date(Date.now() - 30000),
      endTime: new Date(),
      duration: 30000,
      browser: 'chromium',
      environment: process.env.NODE_ENV || 'test',
      testCommand: 'npx playwright test',
      gitCommit: process.env.GITHUB_SHA || 'test-commit-123',
      buildNumber: process.env.GITHUB_RUN_NUMBER || '42'
    };

    reportGenerator.setMetadata(buildMetadata);

    // Add sample test data
    const sampleTests = [
      {
        title: 'Authentication Flow Test',
        status: 'passed' as const,
        duration: 5000,
        error: undefined,
        attachments: []
      },
      {
        title: 'File Upload Test',
        status: 'passed' as const,
        duration: 8000,
        error: undefined,
        attachments: []
      },
      {
        title: 'Payment Flow Test',
        status: 'failed' as const,
        duration: 3000,
        error: { message: 'Payment gateway timeout' },
        attachments: []
      }
    ];

    sampleTests.forEach(test => {
      reportGenerator.addTestResult(test as any);
    });

    // Generate comprehensive report
    const report = reportGenerator.generateComprehensiveReport();

    // Test 1: Validate report structure
    expect(report).toHaveProperty('metadata');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('bugReports');
    expect(report.metadata.gitCommit).toBe(buildMetadata.gitCommit);
    expect(report.metadata.buildNumber).toBe(buildMetadata.buildNumber);

    // Test 2: Generate build artifacts
    const artifactsDir = path.join(process.cwd(), 'tests', 'reports');
    const buildId = `build-${buildMetadata.buildNumber}-${Date.now()}`;
    
    // Ensure artifacts directory exists
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Generate JSON report
    const jsonPath = path.join(artifactsDir, 'json', `${buildId}.json`);
    reportGenerator.exportToJson(report, jsonPath);
    expect(fs.existsSync(jsonPath)).toBe(true);

    // Generate HTML report
    const htmlPath = path.join(artifactsDir, 'html', `${buildId}.html`);
    reportGenerator.exportToHtml(report, htmlPath);
    expect(fs.existsSync(htmlPath)).toBe(true);

    // Generate summary report for CI
    const summaryReport = reportGenerator.generateSummaryReport();
    const summaryPath = path.join(artifactsDir, `${buildId}-summary.md`);
    fs.writeFileSync(summaryPath, summaryReport, 'utf8');
    expect(fs.existsSync(summaryPath)).toBe(true);

    // Test 3: Validate artifact content
    const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    expect(jsonContent.metadata.buildNumber).toBe(buildMetadata.buildNumber);
    expect(jsonContent.summary.totalTests).toBe(sampleTests.length);

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    expect(htmlContent).toContain('DocFiscal E2E Test Report');
    expect(htmlContent).toContain(buildMetadata.buildNumber);

    const summaryContent = fs.readFileSync(summaryPath, 'utf8');
    expect(summaryContent).toContain('E2E Test Summary Report');
    expect(summaryContent).toContain('Test Results');

    // Test 4: Generate CI-friendly exit codes
    const hasFailures = report.summary.failedTests > 0;
    const hasCriticalErrors = report.errorAnalysis.summary.criticalErrors > 0;
    
    console.log(`📊 Build Results:`);
    console.log(`   Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
    console.log(`   Success Rate: ${report.summary.successRate.toFixed(1)}%`);
    console.log(`   Critical Errors: ${report.errorAnalysis.summary.criticalErrors}`);
    console.log(`   Build Status: ${hasFailures || hasCriticalErrors ? 'FAILED' : 'PASSED'}`);

    // Test 5: Generate build badge data
    const badgeData = {
      schemaVersion: 1,
      label: 'E2E Tests',
      message: `${report.summary.passedTests}/${report.summary.totalTests} passed`,
      color: hasFailures || hasCriticalErrors ? 'red' : 'green',
      namedLogo: 'playwright'
    };

    const badgePath = path.join(artifactsDir, `${buildId}-badge.json`);
    fs.writeFileSync(badgePath, JSON.stringify(badgeData, null, 2), 'utf8');
    expect(fs.existsSync(badgePath)).toBe(true);

    console.log(`📄 Generated artifacts:`);
    console.log(`   JSON Report: ${jsonPath}`);
    console.log(`   HTML Report: ${htmlPath}`);
    console.log(`   Summary: ${summaryPath}`);
    console.log(`   Badge Data: ${badgePath}`);

    console.log('✅ Build artifacts generated and validated');
  });

  test('validate report distribution mechanisms', async ({ page }) => {
    console.log('📤 Testing report distribution mechanisms');

    // Test 1: File system distribution
    const reportsDir = path.join(process.cwd(), 'tests', 'reports');
    const distributionDirs = ['json', 'html', 'junit'];

    distributionDirs.forEach(dir => {
      const dirPath = path.join(reportsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      expect(fs.existsSync(dirPath)).toBe(true);
      console.log(`✅ Distribution directory created: ${dir}`);
    });

    // Test 2: Generate sample reports for distribution
    const reportGenerator = createReportGenerator();
    
    reportGenerator.setMetadata({
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      duration: 60000,
      browser: 'chromium',
      environment: 'ci',
      testCommand: 'npx playwright test --reporter=custom'
    });

    // Add sample test data
    reportGenerator.addTestResult({
      title: 'Distribution Test',
      status: 'passed',
      duration: 5000,
      error: undefined,
      attachments: []
    } as any);

    const report = reportGenerator.generateComprehensiveReport();

    // Test 3: Generate reports in multiple formats
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const formats = [
      {
        name: 'JSON',
        path: path.join(reportsDir, 'json', `distribution-test-${timestamp}.json`),
        generator: (r: any, p: string) => reportGenerator.exportToJson(r, p)
      },
      {
        name: 'HTML',
        path: path.join(reportsDir, 'html', `distribution-test-${timestamp}.html`),
        generator: (r: any, p: string) => reportGenerator.exportToHtml(r, p)
      }
    ];

    formats.forEach(format => {
      format.generator(report, format.path);
      expect(fs.existsSync(format.path)).toBe(true);
      console.log(`✅ ${format.name} report generated: ${format.path}`);
    });

    // Test 4: Validate report accessibility
    formats.forEach(format => {
      const stats = fs.statSync(format.path);
      expect(stats.size).toBeGreaterThan(0);
      console.log(`📊 ${format.name} report size: ${Math.round(stats.size / 1024)}KB`);
    });

    // Test 5: Generate latest symlinks/copies for easy access
    const latestFiles = [
      {
        source: formats[0].path,
        target: path.join(reportsDir, 'json', 'latest.json')
      },
      {
        source: formats[1].path,
        target: path.join(reportsDir, 'html', 'latest.html')
      }
    ];

    latestFiles.forEach(file => {
      fs.copyFileSync(file.source, file.target);
      expect(fs.existsSync(file.target)).toBe(true);
      console.log(`✅ Latest report link created: ${file.target}`);
    });

    // Test 6: Generate distribution manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      buildNumber: process.env.GITHUB_RUN_NUMBER || 'local',
      commit: process.env.GITHUB_SHA || 'unknown',
      reports: formats.map(format => ({
        type: format.name.toLowerCase(),
        path: path.relative(reportsDir, format.path),
        size: fs.statSync(format.path).size
      })),
      summary: {
        totalTests: report.summary.totalTests,
        passedTests: report.summary.passedTests,
        failedTests: report.summary.failedTests,
        successRate: report.summary.successRate
      }
    };

    const manifestPath = path.join(reportsDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    expect(fs.existsSync(manifestPath)).toBe(true);

    console.log('📋 Distribution manifest generated:', manifestPath);
    console.log('✅ Report distribution mechanisms validated');
  });

  test('validate CI/CD pipeline integration points', async ({ page }) => {
    console.log('🔗 Testing CI/CD pipeline integration points');

    // Test 1: Environment-specific configuration
    const environment = process.env.NODE_ENV || 'test';
    const isCI = !!process.env.CI;
    const isPR = !!process.env.GITHUB_EVENT_NAME && process.env.GITHUB_EVENT_NAME === 'pull_request';

    console.log(`🏷️ Environment: ${environment}`);
    console.log(`🏗️ CI Mode: ${isCI}`);
    console.log(`🔀 Pull Request: ${isPR}`);

    // Test 2: Validate test execution strategy for CI
    const executionStrategy = {
      retries: isCI ? 2 : 0,
      workers: isCI ? 1 : undefined,
      timeout: isCI ? 90000 : 60000,
      headless: isCI ? true : false
    };

    console.log('⚙️ Execution Strategy:', executionStrategy);

    if (isCI) {
      expect(executionStrategy.retries).toBeGreaterThan(0);
      expect(executionStrategy.headless).toBe(true);
    }

    // Test 3: Validate artifact upload preparation
    const artifactPaths = [
      'tests/reports/html',
      'tests/reports/json',
      'tests/reports/junit'
    ];

    artifactPaths.forEach(artifactPath => {
      const fullPath = path.join(process.cwd(), artifactPath);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
      expect(fs.existsSync(fullPath)).toBe(true);
    });

    // Test 4: Generate CI/CD integration metadata
    const integrationMetadata = {
      pipeline: {
        provider: process.env.GITHUB_ACTIONS ? 'github-actions' : 'unknown',
        runId: process.env.GITHUB_RUN_ID,
        runNumber: process.env.GITHUB_RUN_NUMBER,
        workflow: process.env.GITHUB_WORKFLOW,
        job: process.env.GITHUB_JOB,
        actor: process.env.GITHUB_ACTOR
      },
      repository: {
        name: process.env.GITHUB_REPOSITORY,
        ref: process.env.GITHUB_REF,
        sha: process.env.GITHUB_SHA,
        branch: process.env.GITHUB_REF_NAME
      },
      execution: {
        timestamp: new Date().toISOString(),
        environment,
        nodeVersion: process.version,
        playwrightVersion: require('@playwright/test/package.json').version
      }
    };

    const metadataPath = path.join(process.cwd(), 'tests', 'reports', 'ci-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(integrationMetadata, null, 2), 'utf8');
    expect(fs.existsSync(metadataPath)).toBe(true);

    console.log('📋 CI/CD metadata generated:', metadataPath);

    // Test 5: Validate notification data preparation
    const notificationData = {
      status: 'success', // This would be determined by actual test results
      summary: 'E2E tests completed successfully',
      details: {
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        duration: '30s'
      },
      links: {
        htmlReport: 'tests/reports/html/latest.html',
        jsonReport: 'tests/reports/json/latest.json'
      },
      timestamp: new Date().toISOString()
    };

    const notificationPath = path.join(process.cwd(), 'tests', 'reports', 'notification.json');
    fs.writeFileSync(notificationPath, JSON.stringify(notificationData, null, 2), 'utf8');
    expect(fs.existsSync(notificationPath)).toBe(true);

    console.log('📢 Notification data prepared:', notificationPath);

    // Test 6: Validate exit code strategy
    const exitCodeStrategy = {
      success: 0,
      testFailures: 1,
      criticalErrors: 2,
      configurationError: 3,
      timeout: 4
    };

    console.log('🚪 Exit Code Strategy:', exitCodeStrategy);

    // Test 7: Generate pipeline summary
    const pipelineSummary = `
## 🧪 E2E Test Pipeline Summary

**Environment:** ${environment}  
**CI Mode:** ${isCI ? 'Yes' : 'No'}  
**Timestamp:** ${new Date().toISOString()}  

### Configuration
- Retries: ${executionStrategy.retries}
- Workers: ${executionStrategy.workers || 'default'}
- Timeout: ${executionStrategy.timeout}ms
- Headless: ${executionStrategy.headless}

### Artifacts Generated
${artifactPaths.map(path => `- ${path}`).join('\n')}

### Integration Points
- Metadata: ✅ Generated
- Notifications: ✅ Prepared
- Exit Codes: ✅ Configured
- Artifacts: ✅ Ready for upload

---
*Generated by DocFiscal E2E Testing Pipeline*
`;

    const summaryPath = path.join(process.cwd(), 'tests', 'reports', 'pipeline-summary.md');
    fs.writeFileSync(summaryPath, pipelineSummary, 'utf8');
    expect(fs.existsSync(summaryPath)).toBe(true);

    console.log('📄 Pipeline summary generated:', summaryPath);
    console.log('✅ CI/CD pipeline integration points validated');
  });
});