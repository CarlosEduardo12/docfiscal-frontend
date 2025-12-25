import { TestResult, FullResult } from '@playwright/test/reporter';
import { createErrorReporter, ErrorReport, FlowResult, Evidence, UIElementTest } from './error-reporter';
import { NetworkError } from './network-logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test execution metadata
 */
export interface TestExecutionMetadata {
  startTime: Date;
  endTime: Date;
  duration: number;
  browser: string;
  environment: string;
  testCommand: string;
  gitCommit?: string;
  buildNumber?: string;
}

/**
 * Bug report interface for actionable debugging
 */
export interface BugReport {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'backend' | 'frontend' | 'integration' | 'performance';
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  evidence: Evidence[];
  affectedFlows: string[];
  networkErrors: NetworkError[];
  timestamp: Date;
}

/**
 * Comprehensive test report interface
 */
export interface ComprehensiveTestReport {
  metadata: TestExecutionMetadata;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    flakyTests: number;
    duration: number;
    successRate: number;
  };
  errorAnalysis: ErrorReport;
  bugReports: BugReport[];
  flowCoverage: {
    totalFlows: number;
    coveredFlows: number;
    coverage: number;
    uncoveredFlows: string[];
  };
  performance: {
    averageTestDuration: number;
    slowestTests: { name: string; duration: number }[];
    fastestTests: { name: string; duration: number }[];
  };
  environment: {
    nodeVersion: string;
    playwrightVersion: string;
    browserVersions: Record<string, string>;
    os: string;
  };
  recommendations: string[];
  generatedAt: Date;
}

/**
 * Report generator class for comprehensive test reporting
 */
export class ReportGenerator {
  private errorReporter = createErrorReporter();
  private networkErrors: NetworkError[] = [];
  private testResults: TestResult[] = [];
  private metadata: Partial<TestExecutionMetadata> = {};

  /**
   * Set test execution metadata
   */
  setMetadata(metadata: Partial<TestExecutionMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  /**
   * Add network errors from test execution
   */
  addNetworkErrors(errors: NetworkError[]): void {
    this.networkErrors.push(...errors);
  }

  /**
   * Add test result
   */
  addTestResult(result: TestResult): void {
    this.testResults.push(result);
  }

  /**
   * Add UI element test
   */
  addUIElementTest(test: UIElementTest): void {
    this.errorReporter.addUIElementTest(test);
  }

  /**
   * Add flow result
   */
  addFlowResult(result: FlowResult): void {
    this.errorReporter.addFlowResult(result);
  }

  /**
   * Generate comprehensive test report
   */
  generateComprehensiveReport(): ComprehensiveTestReport {
    const errorAnalysis = this.errorReporter.generateReport(this.networkErrors);
    const bugReports = this.generateBugReports();
    const summary = this.generateTestSummary();
    const flowCoverage = this.generateFlowCoverage();
    const performance = this.generatePerformanceAnalysis();
    const environment = this.generateEnvironmentInfo();
    const recommendations = this.generateRecommendations(errorAnalysis, bugReports);

    return {
      metadata: this.getCompleteMetadata(),
      summary,
      errorAnalysis,
      bugReports,
      flowCoverage,
      performance,
      environment,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * Generate bug reports from errors and test failures
   */
  private generateBugReports(): BugReport[] {
    const bugReports: BugReport[] = [];
    const bugId = () => `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Generate bug reports from critical network errors
    const criticalErrors = this.networkErrors.filter(e => e.severity === 'critical');
    const errorsByEndpoint = this.groupErrorsByEndpoint(criticalErrors);

    Object.entries(errorsByEndpoint).forEach(([endpoint, errors]) => {
      if (errors.length > 0) {
        const firstError = errors[0];
        const bugReport: BugReport = {
          id: bugId(),
          title: `Critical API Error: ${endpoint} returning ${firstError.response.status}`,
          severity: 'critical',
          category: 'backend',
          description: `The ${endpoint} endpoint is consistently returning ${firstError.response.status} errors, affecting core functionality.`,
          stepsToReproduce: [
            `1. Navigate to the flow: ${firstError.flow}`,
            `2. Execute step: ${firstError.step}`,
            `3. Make ${firstError.request.method} request to ${endpoint}`,
            `4. Observe ${firstError.response.status} error response`
          ],
          expectedBehavior: `${endpoint} should return successful response (2xx status code)`,
          actualBehavior: `${endpoint} returns ${firstError.response.status} ${firstError.response.statusText}`,
          evidence: [{
            type: 'network_log',
            data: JSON.stringify(firstError, null, 2),
            timestamp: firstError.timestamp,
            description: `Network error details for ${endpoint}`
          }],
          affectedFlows: [...new Set(errors.map(e => e.flow))],
          networkErrors: errors,
          timestamp: new Date()
        };
        bugReports.push(bugReport);
      }
    });

    // Generate bug reports from failed tests
    const failedTests = this.testResults.filter(r => r.status === 'failed');
    failedTests.forEach(test => {
      const bugReport: BugReport = {
        id: bugId(),
        title: `Test Failure: ${test.title}`,
        severity: this.determineBugSeverity(test),
        category: 'integration',
        description: `Test "${test.title}" is failing consistently.`,
        stepsToReproduce: [
          `1. Run test: ${test.title}`,
          `2. Observe test failure`,
          `3. Check error details and logs`
        ],
        expectedBehavior: 'Test should pass successfully',
        actualBehavior: `Test fails with error: ${test.error?.message || 'Unknown error'}`,
        evidence: this.extractEvidenceFromTest(test),
        affectedFlows: [test.title],
        networkErrors: this.networkErrors.filter(e => e.flow === test.title),
        timestamp: new Date()
      };
      bugReports.push(bugReport);
    });

    return bugReports;
  }

  /**
   * Group errors by endpoint for analysis
   */
  private groupErrorsByEndpoint(errors: NetworkError[]): Record<string, NetworkError[]> {
    const grouped: Record<string, NetworkError[]> = {};
    
    errors.forEach(error => {
      const endpoint = this.extractEndpoint(error.request.url);
      if (!grouped[endpoint]) {
        grouped[endpoint] = [];
      }
      grouped[endpoint].push(error);
    });

    return grouped;
  }

  /**
   * Extract endpoint from URL
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/\/\d+/g, '/{id}').replace(/\/[a-f0-9]{24}/g, '/{id}');
    } catch {
      return url;
    }
  }

  /**
   * Determine bug severity from test result
   */
  private determineBugSeverity(test: TestResult): 'critical' | 'high' | 'medium' | 'low' {
    const title = test.title.toLowerCase();
    
    if (title.includes('login') || title.includes('auth') || title.includes('payment')) {
      return 'critical';
    } else if (title.includes('upload') || title.includes('download') || title.includes('order')) {
      return 'high';
    } else if (title.includes('ui') || title.includes('navigation')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Extract evidence from test result
   */
  private extractEvidenceFromTest(test: TestResult): Evidence[] {
    const evidence: Evidence[] = [];

    if (test.error) {
      evidence.push({
        type: 'console_log',
        data: test.error.message || 'Unknown error',
        timestamp: new Date(),
        description: 'Test error message'
      });
    }

    // Add screenshot if available
    if (test.attachments) {
      test.attachments.forEach(attachment => {
        if (attachment.name === 'screenshot') {
          evidence.push({
            type: 'screenshot',
            data: attachment.path || '',
            timestamp: new Date(),
            description: 'Test failure screenshot'
          });
        }
      });
    }

    return evidence;
  }

  /**
   * Generate test summary
   */
  private generateTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'passed').length;
    const failedTests = this.testResults.filter(r => r.status === 'failed').length;
    const skippedTests = this.testResults.filter(r => r.status === 'skipped').length;
    const flakyTests = this.testResults.filter(r => r.status === 'flaky').length;
    const duration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      flakyTests,
      duration,
      successRate
    };
  }

  /**
   * Generate flow coverage analysis
   */
  private generateFlowCoverage() {
    const expectedFlows = [
      'authentication-flow',
      'file-upload-flow',
      'payment-flow',
      'order-management-flow',
      'download-flow',
      'dashboard-navigation',
      'responsive-design',
      'error-handling'
    ];

    const testedFlows = [...new Set(this.testResults.map(r => this.extractFlowName(r.title)))];
    const coveredFlows = expectedFlows.filter(flow => 
      testedFlows.some(tested => tested.includes(flow) || flow.includes(tested))
    );
    const uncoveredFlows = expectedFlows.filter(flow => !coveredFlows.includes(flow));

    return {
      totalFlows: expectedFlows.length,
      coveredFlows: coveredFlows.length,
      coverage: (coveredFlows.length / expectedFlows.length) * 100,
      uncoveredFlows
    };
  }

  /**
   * Extract flow name from test title
   */
  private extractFlowName(title: string): string {
    const flowKeywords = {
      'auth': 'authentication-flow',
      'login': 'authentication-flow',
      'register': 'authentication-flow',
      'upload': 'file-upload-flow',
      'payment': 'payment-flow',
      'order': 'order-management-flow',
      'download': 'download-flow',
      'dashboard': 'dashboard-navigation',
      'responsive': 'responsive-design',
      'error': 'error-handling'
    };

    const lowerTitle = title.toLowerCase();
    for (const [keyword, flow] of Object.entries(flowKeywords)) {
      if (lowerTitle.includes(keyword)) {
        return flow;
      }
    }

    return 'unknown-flow';
  }

  /**
   * Generate performance analysis
   */
  private generatePerformanceAnalysis() {
    const durations = this.testResults.map(r => r.duration);
    const averageTestDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const sortedTests = [...this.testResults].sort((a, b) => b.duration - a.duration);
    const slowestTests = sortedTests.slice(0, 5).map(t => ({ name: t.title, duration: t.duration }));
    const fastestTests = sortedTests.slice(-5).reverse().map(t => ({ name: t.title, duration: t.duration }));

    return {
      averageTestDuration,
      slowestTests,
      fastestTests
    };
  }

  /**
   * Generate environment information
   */
  private generateEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      playwrightVersion: require('@playwright/test/package.json').version,
      browserVersions: {
        chromium: 'Latest',
        firefox: 'Latest',
        webkit: 'Latest'
      },
      os: process.platform
    };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(errorAnalysis: ErrorReport, bugReports: BugReport[]): string[] {
    const recommendations: string[] = [];

    // Critical bug recommendations
    const criticalBugs = bugReports.filter(b => b.severity === 'critical');
    if (criticalBugs.length > 0) {
      recommendations.push(`🚨 URGENT: ${criticalBugs.length} critical bugs detected. These should be fixed immediately before any deployment.`);
    }

    // Backend error recommendations
    if (errorAnalysis.summary.totalErrors > 0) {
      recommendations.push(`🔧 Backend Issues: ${errorAnalysis.summary.totalErrors} API errors detected. Review backend logs and fix failing endpoints.`);
    }

    // Test stability recommendations
    const failureRate = (errorAnalysis.summary.failedTests / errorAnalysis.summary.totalTests) * 100;
    if (failureRate > 10) {
      recommendations.push(`📊 Test Stability: ${failureRate.toFixed(1)}% test failure rate is too high. Investigate flaky tests and improve test reliability.`);
    }

    // Performance recommendations
    const slowTests = this.testResults.filter(r => r.duration > 30000); // > 30 seconds
    if (slowTests.length > 0) {
      recommendations.push(`⚡ Performance: ${slowTests.length} tests are running slowly (>30s). Consider optimizing test execution or splitting into smaller tests.`);
    }

    // Coverage recommendations
    const coverage = this.generateFlowCoverage();
    if (coverage.coverage < 80) {
      recommendations.push(`📈 Coverage: Flow coverage is ${coverage.coverage.toFixed(1)}%. Consider adding tests for: ${coverage.uncoveredFlows.join(', ')}`);
    }

    // Success recommendations
    if (criticalBugs.length === 0 && errorAnalysis.summary.totalErrors === 0) {
      recommendations.push('✅ Excellent! No critical issues detected. All core flows are working correctly.');
    }

    return recommendations;
  }

  /**
   * Get complete metadata with defaults
   */
  private getCompleteMetadata(): TestExecutionMetadata {
    return {
      startTime: this.metadata.startTime || new Date(),
      endTime: this.metadata.endTime || new Date(),
      duration: this.metadata.duration || 0,
      browser: this.metadata.browser || 'chromium',
      environment: this.metadata.environment || 'test',
      testCommand: this.metadata.testCommand || 'npx playwright test',
      gitCommit: this.metadata.gitCommit,
      buildNumber: this.metadata.buildNumber
    };
  }

  /**
   * Export comprehensive report to JSON
   */
  exportToJson(report: ComprehensiveTestReport, outputPath: string): void {
    const jsonContent = JSON.stringify(report, null, 2);
    this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    console.log(`📄 JSON report exported to: ${outputPath}`);
  }

  /**
   * Export comprehensive report to HTML
   */
  exportToHtml(report: ComprehensiveTestReport, outputPath: string): void {
    const htmlContent = this.generateHtmlReport(report);
    this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, htmlContent, 'utf8');
    console.log(`🌐 HTML report exported to: ${outputPath}`);
  }

  /**
   * Generate comprehensive HTML report
   */
  private generateHtmlReport(report: ComprehensiveTestReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DocFiscal E2E Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #333; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; transition: transform 0.2s; }
        .summary-card:hover { transform: translateY(-2px); }
        .summary-card h3 { font-size: 2.5em; margin-bottom: 10px; }
        .summary-card p { color: #666; font-size: 1.1em; }
        .card-success { border-left: 5px solid #28a745; }
        .card-warning { border-left: 5px solid #ffc107; }
        .card-danger { border-left: 5px solid #dc3545; }
        .card-info { border-left: 5px solid #17a2b8; }
        .section { background: white; margin-bottom: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .section-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #dee2e6; }
        .section-header h2 { color: #495057; display: flex; align-items: center; gap: 10px; }
        .section-content { padding: 25px; }
        .recommendations { background: #e7f3ff; border: 1px solid #b8daff; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .recommendations ul { list-style: none; }
        .recommendations li { margin: 10px 0; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid #007bff; }
        .bug-report { background: #fff5f5; border: 1px solid #fed7d7; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .bug-critical { border-left: 5px solid #e53e3e; }
        .bug-high { border-left: 5px solid #dd6b20; }
        .bug-medium { border-left: 5px solid #d69e2e; }
        .bug-low { border-left: 5px solid #38a169; }
        .bug-header { display: flex; justify-content: between; align-items: center; margin-bottom: 15px; }
        .bug-severity { padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.85em; font-weight: bold; }
        .severity-critical { background: #e53e3e; }
        .severity-high { background: #dd6b20; }
        .severity-medium { background: #d69e2e; }
        .severity-low { background: #38a169; }
        .error-list { max-height: 400px; overflow-y: auto; }
        .error-item { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin: 10px 0; }
        .error-status { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; font-weight: bold; }
        .status-4xx { background: #ffc107; color: #000; }
        .status-5xx { background: #dc3545; }
        .flow-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .flow-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; }
        .flow-status { padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.85em; font-weight: bold; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-skipped { background: #6c757d; }
        .performance-chart { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .chart-section h4 { margin-bottom: 15px; color: #495057; }
        .test-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 6px; margin: 5px 0; }
        .duration { font-weight: bold; color: #007bff; }
        .footer { text-align: center; padding: 30px; color: #666; }
        .tabs { display: flex; border-bottom: 1px solid #dee2e6; margin-bottom: 20px; }
        .tab { padding: 12px 24px; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s; }
        .tab:hover { background: #f8f9fa; }
        .tab.active { border-bottom-color: #007bff; color: #007bff; font-weight: bold; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .summary-grid { grid-template-columns: 1fr; }
            .performance-chart { grid-template-columns: 1fr; }
            .flow-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 DocFiscal E2E Test Report</h1>
            <p>Generated on ${report.generatedAt.toLocaleString()}</p>
            <p>Environment: ${report.metadata.environment} | Browser: ${report.metadata.browser} | Duration: ${Math.round(report.metadata.duration / 1000)}s</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card ${report.summary.successRate >= 90 ? 'card-success' : report.summary.successRate >= 70 ? 'card-warning' : 'card-danger'}">
                <h3>${report.summary.successRate.toFixed(1)}%</h3>
                <p>Success Rate</p>
            </div>
            <div class="summary-card ${report.summary.failedTests === 0 ? 'card-success' : 'card-danger'}">
                <h3>${report.summary.passedTests}/${report.summary.totalTests}</h3>
                <p>Tests Passed</p>
            </div>
            <div class="summary-card ${report.errorAnalysis.summary.criticalErrors === 0 ? 'card-success' : 'card-danger'}">
                <h3>${report.errorAnalysis.summary.criticalErrors}</h3>
                <p>Critical Errors</p>
            </div>
            <div class="summary-card ${report.flowCoverage.coverage >= 80 ? 'card-success' : 'card-warning'}">
                <h3>${report.flowCoverage.coverage.toFixed(1)}%</h3>
                <p>Flow Coverage</p>
            </div>
        </div>

        ${report.recommendations.length > 0 ? `
        <div class="section">
            <div class="section-header">
                <h2>📋 Key Recommendations</h2>
            </div>
            <div class="section-content">
                <div class="recommendations">
                    <ul>
                        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
        ` : ''}

        ${report.bugReports.length > 0 ? `
        <div class="section">
            <div class="section-header">
                <h2>🐛 Bug Reports (${report.bugReports.length})</h2>
            </div>
            <div class="section-content">
                ${report.bugReports.map(bug => `
                    <div class="bug-report bug-${bug.severity}">
                        <div class="bug-header">
                            <h4>${bug.title}</h4>
                            <span class="bug-severity severity-${bug.severity}">${bug.severity.toUpperCase()}</span>
                        </div>
                        <p><strong>Description:</strong> ${bug.description}</p>
                        <p><strong>Expected:</strong> ${bug.expectedBehavior}</p>
                        <p><strong>Actual:</strong> ${bug.actualBehavior}</p>
                        <p><strong>Affected Flows:</strong> ${bug.affectedFlows.join(', ')}</p>
                        ${bug.networkErrors.length > 0 ? `<p><strong>Network Errors:</strong> ${bug.networkErrors.length}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-header">
                <h2>📊 Test Results Analysis</h2>
            </div>
            <div class="section-content">
                <div class="tabs">
                    <div class="tab active" onclick="showTab('flow-coverage')">Flow Coverage</div>
                    <div class="tab" onclick="showTab('performance')">Performance</div>
                    <div class="tab" onclick="showTab('errors')">Error Analysis</div>
                </div>

                <div id="flow-coverage" class="tab-content active">
                    <div class="flow-grid">
                        ${report.errorAnalysis.flowCoverage.flowDetails.map(flow => `
                            <div class="flow-card">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <h4>${flow.name}</h4>
                                    <span class="flow-status status-${flow.status}">${flow.status.toUpperCase()}</span>
                                </div>
                                <p><strong>Steps:</strong> ${flow.steps}</p>
                                <p><strong>Duration:</strong> ${flow.duration}ms</p>
                                <p><strong>Errors:</strong> ${flow.errors}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div id="performance" class="tab-content">
                    <div class="performance-chart">
                        <div class="chart-section">
                            <h4>⚡ Slowest Tests</h4>
                            ${report.performance.slowestTests.map(test => `
                                <div class="test-item">
                                    <span>${test.name}</span>
                                    <span class="duration">${(test.duration / 1000).toFixed(1)}s</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="chart-section">
                            <h4>🚀 Fastest Tests</h4>
                            ${report.performance.fastestTests.map(test => `
                                <div class="test-item">
                                    <span>${test.name}</span>
                                    <span class="duration">${(test.duration / 1000).toFixed(1)}s</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div id="errors" class="tab-content">
                    ${Object.keys(report.errorAnalysis.errors.byEndpoint).length > 0 ? `
                        <div class="error-list">
                            ${Object.entries(report.errorAnalysis.errors.byEndpoint).map(([endpoint, errors]) => `
                                <div class="error-item">
                                    <h4>${endpoint} (${errors.length} errors)</h4>
                                    ${errors.slice(0, 3).map(error => `
                                        <div style="margin: 8px 0;">
                                            <span class="error-status status-${Math.floor(error.response.status / 100)}xx">
                                                ${error.response.status}
                                            </span>
                                            ${error.request.method} - ${error.response.statusText}
                                            <small style="color: #666; margin-left: 10px;">${error.timestamp.toLocaleTimeString()}</small>
                                        </div>
                                    `).join('')}
                                    ${errors.length > 3 ? `<small style="color: #666;">... and ${errors.length - 3} more errors</small>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>✅ No backend errors detected!</p>'}
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Report generated by DocFiscal E2E Testing System</p>
            <p>Node.js ${report.environment.nodeVersion} | Playwright ${report.environment.playwrightVersion} | ${report.environment.os}</p>
        </div>
    </div>

    <script>
        function showTab(tabId) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(tabId).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate summary report for CI/CD integration
   */
  generateSummaryReport(): string {
    const report = this.generateComprehensiveReport();
    
    return `
# E2E Test Summary Report

## 📊 Test Results
- **Total Tests**: ${report.summary.totalTests}
- **Passed**: ${report.summary.passedTests}
- **Failed**: ${report.summary.failedTests}
- **Success Rate**: ${report.summary.successRate.toFixed(1)}%

## 🐛 Issues Found
- **Critical Bugs**: ${report.bugReports.filter(b => b.severity === 'critical').length}
- **Backend Errors**: ${report.errorAnalysis.summary.totalErrors}
- **Critical Errors**: ${report.errorAnalysis.summary.criticalErrors}

## 📈 Coverage
- **Flow Coverage**: ${report.flowCoverage.coverage.toFixed(1)}%
- **Covered Flows**: ${report.flowCoverage.coveredFlows}/${report.flowCoverage.totalFlows}

## 🎯 Key Recommendations
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
Generated on ${report.generatedAt.toLocaleString()}
`;
  }
}

/**
 * Create a new report generator instance
 */
export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}