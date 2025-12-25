import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { createReportGenerator, ReportGenerator } from './report-generator';
import { createNetworkLogger, NetworkError } from './network-logger';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Custom Playwright reporter for comprehensive E2E test reporting
 * Integrates with our error analysis and report generation system
 */
export class DocFiscalE2EReporter implements Reporter {
  private reportGenerator: ReportGenerator;
  private startTime: Date = new Date();
  private config: FullConfig | null = null;
  private networkErrors: NetworkError[] = [];

  constructor() {
    this.reportGenerator = createReportGenerator();
    console.log('🧪 DocFiscal E2E Reporter initialized');
  }

  /**
   * Called once before running tests
   */
  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.startTime = new Date();
    
    console.log(`🚀 Starting E2E test execution with ${suite.allTests().length} tests`);
    console.log(`📊 Running on: ${config.projects.map(p => p.name).join(', ')}`);
    
    // Set initial metadata
    this.reportGenerator.setMetadata({
      startTime: this.startTime,
      browser: config.projects[0]?.name || 'chromium',
      environment: process.env.NODE_ENV || 'test',
      testCommand: process.argv.join(' ')
    });
  }

  /**
   * Called after a test has been finished
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    // Add test result to report generator
    this.reportGenerator.addTestResult(result);
    
    // Extract network errors from test annotations or attachments
    this.extractNetworkErrorsFromTest(test, result);
    
    // Log test completion
    const status = result.status;
    const duration = result.duration;
    const emoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
    
    console.log(`${emoji} ${test.title} (${duration}ms)`);
    
    if (status === 'failed' && result.error) {
      console.log(`   Error: ${result.error.message}`);
    }
  }

  /**
   * Called after all tests have been run
   */
  onEnd(result: FullResult): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    
    console.log(`\n🏁 Test execution completed in ${Math.round(duration / 1000)}s`);
    console.log(`📊 Results: ${result.status}`);
    
    // Update metadata with final information
    this.reportGenerator.setMetadata({
      endTime,
      duration,
      gitCommit: process.env.GITHUB_SHA || process.env.GIT_COMMIT,
      buildNumber: process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER
    });
    
    // Add collected network errors
    this.reportGenerator.addNetworkErrors(this.networkErrors);
    
    // Generate comprehensive report
    const comprehensiveReport = this.reportGenerator.generateComprehensiveReport();
    
    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'tests', 'reports');
    this.ensureDirectoryExists(reportsDir);
    
    // Export reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(reportsDir, 'json', `e2e-report-${timestamp}.json`);
    const htmlPath = path.join(reportsDir, 'html', `e2e-report-${timestamp}.html`);
    const latestHtmlPath = path.join(reportsDir, 'html', 'latest.html');
    const latestJsonPath = path.join(reportsDir, 'json', 'latest.json');
    
    try {
      // Export timestamped reports
      this.reportGenerator.exportToJson(comprehensiveReport, jsonPath);
      this.reportGenerator.exportToHtml(comprehensiveReport, htmlPath);
      
      // Export latest reports (for easy access)
      this.reportGenerator.exportToJson(comprehensiveReport, latestJsonPath);
      this.reportGenerator.exportToHtml(comprehensiveReport, latestHtmlPath);
      
      // Generate summary for console output
      this.printSummaryToConsole(comprehensiveReport);
      
      // Generate summary report for CI/CD
      const summaryReport = this.reportGenerator.generateSummaryReport();
      const summaryPath = path.join(reportsDir, 'summary.md');
      fs.writeFileSync(summaryPath, summaryReport, 'utf8');
      
      console.log(`\n📄 Reports generated:`);
      console.log(`   HTML: ${htmlPath}`);
      console.log(`   JSON: ${jsonPath}`);
      console.log(`   Summary: ${summaryPath}`);
      console.log(`   Latest HTML: ${latestHtmlPath}`);
      
    } catch (error) {
      console.error('❌ Error generating reports:', error);
    }
  }

  /**
   * Extract network errors from test results
   */
  private extractNetworkErrorsFromTest(test: TestCase, result: TestResult): void {
    // Check test annotations for network errors
    if (result.attachments) {
      result.attachments.forEach(attachment => {
        if (attachment.name === 'network-errors' && attachment.body) {
          try {
            const errors = JSON.parse(attachment.body.toString());
            if (Array.isArray(errors)) {
              this.networkErrors.push(...errors);
            }
          } catch (error) {
            console.warn('Failed to parse network errors from test attachment:', error);
          }
        }
      });
    }
    
    // Extract errors from test metadata if available
    if ((test as any).networkErrors) {
      this.networkErrors.push(...(test as any).networkErrors);
    }
  }

  /**
   * Print summary to console
   */
  private printSummaryToConsole(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 E2E TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    
    // Test results
    console.log(`\n🧪 Test Results:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Passed: ${report.summary.passedTests} ✅`);
    console.log(`   Failed: ${report.summary.failedTests} ❌`);
    console.log(`   Skipped: ${report.summary.skippedTests} ⏭️`);
    console.log(`   Success Rate: ${report.summary.successRate.toFixed(1)}%`);
    
    // Error analysis
    console.log(`\n🔍 Error Analysis:`);
    console.log(`   Backend Errors: ${report.errorAnalysis.summary.totalErrors}`);
    console.log(`   Critical Errors: ${report.errorAnalysis.summary.criticalErrors}`);
    
    // Bug reports
    if (report.bugReports.length > 0) {
      console.log(`\n🐛 Bug Reports: ${report.bugReports.length}`);
      const criticalBugs = report.bugReports.filter((b: any) => b.severity === 'critical');
      const highBugs = report.bugReports.filter((b: any) => b.severity === 'high');
      
      if (criticalBugs.length > 0) {
        console.log(`   Critical: ${criticalBugs.length} 🚨`);
      }
      if (highBugs.length > 0) {
        console.log(`   High: ${highBugs.length} ⚠️`);
      }
    }
    
    // Flow coverage
    console.log(`\n📈 Flow Coverage:`);
    console.log(`   Coverage: ${report.flowCoverage.coverage.toFixed(1)}%`);
    console.log(`   Covered Flows: ${report.flowCoverage.coveredFlows}/${report.flowCoverage.totalFlows}`);
    
    // Performance
    console.log(`\n⚡ Performance:`);
    console.log(`   Average Test Duration: ${(report.performance.averageTestDuration / 1000).toFixed(1)}s`);
    console.log(`   Total Execution Time: ${Math.round(report.metadata.duration / 1000)}s`);
    
    // Key recommendations
    if (report.recommendations.length > 0) {
      console.log(`\n🎯 Key Recommendations:`);
      report.recommendations.slice(0, 3).forEach((rec: string) => {
        console.log(`   • ${rec}`);
      });
      
      if (report.recommendations.length > 3) {
        console.log(`   ... and ${report.recommendations.length - 3} more (see full report)`);
      }
    }
    
    // Final status
    console.log('\n' + '='.repeat(60));
    if (report.errorAnalysis.summary.criticalErrors === 0 && report.summary.failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED - NO CRITICAL ISSUES DETECTED!');
    } else if (report.errorAnalysis.summary.criticalErrors > 0) {
      console.log('🚨 CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED!');
    } else {
      console.log('⚠️  SOME ISSUES DETECTED - REVIEW RECOMMENDED');
    }
    console.log('='.repeat(60));
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
   * Called when the reporter is being closed
   */
  onExit(): void {
    console.log('👋 DocFiscal E2E Reporter finished');
  }
}

/**
 * Export the reporter for Playwright configuration
 */
export default DocFiscalE2EReporter;