import { NetworkError } from './network-logger';

/**
 * UI Element status tracking interface
 */
export interface UIElementStatus {
  element: string;
  page: string;
  selector: string;
  status: 'working' | 'broken' | 'not_tested';
  error?: string;
  screenshot?: string;
  timestamp: Date;
}

/**
 * Flow coverage reporting interface
 */
export interface FlowCoverageReport {
  totalFlows: number;
  testedFlows: number;
  passedFlows: number;
  failedFlows: number;
  coverage: number;
  flowDetails: FlowDetail[];
}

/**
 * Individual flow detail interface
 */
export interface FlowDetail {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: number;
  errors: number;
  lastRun: Date;
}

/**
 * Flow result interface for test execution
 */
export interface FlowResult {
  flowName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: StepResult[];
  errors: NetworkError[];
  evidence: Evidence[];
  metadata: {
    browser: string;
    viewport: string;
    timestamp: Date;
  };
}

/**
 * Step result interface
 */
export interface StepResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

/**
 * Evidence interface for debugging
 */
export interface Evidence {
  type: 'screenshot' | 'network_log' | 'console_log' | 'page_source';
  data: string;
  timestamp: Date;
  description: string;
}

/**
 * Error summary interface
 */
export interface ErrorSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalErrors: number;
  criticalErrors: number;
  executionTime: number;
  timestamp: Date;
}

/**
 * Categorized errors interface
 */
export interface CategorizedErrors {
  byEndpoint: Record<string, NetworkError[]>;
  byType: Record<string, NetworkError[]>;
  byFlow: Record<string, NetworkError[]>;
  bySeverity: Record<string, NetworkError[]>;
}

/**
 * Complete error report interface
 */
export interface ErrorReport {
  summary: ErrorSummary;
  errors: CategorizedErrors;
  evidence: Evidence[];
  recommendations: string[];
  uiElements: UIElementStatus[];
  flowCoverage: FlowCoverageReport;
  generatedAt: Date;
}

/**
 * UI Element test interface
 */
export interface UIElementTest {
  element: string;
  page: string;
  selector: string;
  expectedBehavior: string;
  actualResult: 'working' | 'broken' | 'not_tested';
  error?: string;
  screenshot?: string;
}

/**
 * Error Reporter class for comprehensive error analysis and reporting
 */
export class ErrorReporter {
  private uiElementTests: UIElementTest[] = [];
  private flowResults: FlowResult[] = [];
  private evidence: Evidence[] = [];

  /**
   * Add UI element test result
   */
  addUIElementTest(test: UIElementTest): void {
    this.uiElementTests.push(test);
  }

  /**
   * Add flow result
   */
  addFlowResult(result: FlowResult): void {
    this.flowResults.push(result);
    // Add evidence from flow result
    this.evidence.push(...result.evidence);
  }

  /**
   * Add evidence
   */
  addEvidence(evidence: Evidence): void {
    this.evidence.push(evidence);
  }

  /**
   * Generate comprehensive error report
   */
  generateReport(errors: NetworkError[]): ErrorReport {
    const summary = this.generateSummary(errors);
    const categorizedErrors = this.categorizeErrors(errors);
    const recommendations = this.generateRecommendations(errors, categorizedErrors);
    const uiElements = this.generateUIElementReport();
    const flowCoverage = this.generateFlowCoverageReport();

    return {
      summary,
      errors: categorizedErrors,
      evidence: this.evidence,
      recommendations,
      uiElements,
      flowCoverage,
      generatedAt: new Date()
    };
  }

  /**
   * Generate error summary
   */
  private generateSummary(errors: NetworkError[]): ErrorSummary {
    const totalTests = this.flowResults.length;
    const passedTests = this.flowResults.filter(r => r.status === 'passed').length;
    const failedTests = this.flowResults.filter(r => r.status === 'failed').length;
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const totalExecutionTime = this.flowResults.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      totalErrors: errors.length,
      criticalErrors,
      executionTime: totalExecutionTime,
      timestamp: new Date()
    };
  }

  /**
   * Categorize errors by different dimensions
   */
  private categorizeErrors(errors: NetworkError[]): CategorizedErrors {
    const byEndpoint: Record<string, NetworkError[]> = {};
    const byType: Record<string, NetworkError[]> = {};
    const byFlow: Record<string, NetworkError[]> = {};
    const bySeverity: Record<string, NetworkError[]> = {};

    errors.forEach(error => {
      // By endpoint
      const endpoint = this.extractEndpoint(error.request.url);
      if (!byEndpoint[endpoint]) byEndpoint[endpoint] = [];
      byEndpoint[endpoint].push(error);

      // By type (HTTP status category)
      const type = `${Math.floor(error.response.status / 100)}xx`;
      if (!byType[type]) byType[type] = [];
      byType[type].push(error);

      // By flow
      const flow = error.flow || 'unknown';
      if (!byFlow[flow]) byFlow[flow] = [];
      byFlow[flow].push(error);

      // By severity
      const severity = error.severity;
      if (!bySeverity[severity]) bySeverity[severity] = [];
      bySeverity[severity].push(error);
    });

    return { byEndpoint, byType, byFlow, bySeverity };
  }

  /**
   * Extract endpoint from URL for categorization
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Remove dynamic segments (IDs, UUIDs)
      const normalized = pathname
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
        .replace(/\/\d+/g, '/{id}')
        .replace(/\/[a-f0-9]{24}/g, '/{id}');
      
      return normalized;
    } catch {
      return url;
    }
  }

  /**
   * Generate actionable recommendations based on errors
   */
  private generateRecommendations(errors: NetworkError[], categorized: CategorizedErrors): string[] {
    const recommendations: string[] = [];

    // Critical error recommendations
    const criticalErrors = errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push(`🚨 CRITICAL: ${criticalErrors.length} critical errors detected. These should be fixed immediately as they affect core functionality.`);
    }

    // Server error recommendations
    const serverErrors = errors.filter(e => e.category === 'server');
    if (serverErrors.length > 0) {
      recommendations.push(`🔧 SERVER: ${serverErrors.length} server errors (5xx) detected. Check backend logs and server health.`);
    }

    // Authentication error recommendations
    const authErrors = errors.filter(e => e.response.status === 401 || e.response.status === 403);
    if (authErrors.length > 0) {
      recommendations.push(`🔐 AUTH: ${authErrors.length} authentication errors detected. Verify token handling and session management.`);
    }

    // Endpoint-specific recommendations
    Object.entries(categorized.byEndpoint).forEach(([endpoint, endpointErrors]) => {
      if (endpointErrors.length > 3) {
        recommendations.push(`📍 ENDPOINT: ${endpoint} has ${endpointErrors.length} errors. This endpoint needs investigation.`);
      }
    });

    // Flow-specific recommendations
    Object.entries(categorized.byFlow).forEach(([flow, flowErrors]) => {
      if (flowErrors.length > 0) {
        recommendations.push(`🔄 FLOW: ${flow} flow has ${flowErrors.length} errors. Review this user journey.`);
      }
    });

    // General recommendations
    if (errors.length === 0) {
      recommendations.push('✅ No backend errors detected. All API endpoints are responding correctly.');
    } else {
      recommendations.push(`📊 Total of ${errors.length} errors detected across ${Object.keys(categorized.byEndpoint).length} endpoints.`);
    }

    return recommendations;
  }

  /**
   * Generate UI element status report
   */
  generateUIElementReport(): UIElementStatus[] {
    return this.uiElementTests.map(test => ({
      element: test.element,
      page: test.page,
      selector: test.selector,
      status: test.actualResult,
      error: test.error,
      screenshot: test.screenshot,
      timestamp: new Date()
    }));
  }

  /**
   * Generate flow coverage report
   */
  private generateFlowCoverageReport(): FlowCoverageReport {
    const totalFlows = this.flowResults.length;
    const testedFlows = this.flowResults.filter(r => r.status !== 'skipped').length;
    const passedFlows = this.flowResults.filter(r => r.status === 'passed').length;
    const failedFlows = this.flowResults.filter(r => r.status === 'failed').length;
    const coverage = totalFlows > 0 ? (testedFlows / totalFlows) * 100 : 0;

    const flowDetails: FlowDetail[] = this.flowResults.map(result => ({
      name: result.flowName,
      status: result.status,
      duration: result.duration,
      steps: result.steps.length,
      errors: result.errors.length,
      lastRun: result.metadata.timestamp
    }));

    return {
      totalFlows,
      testedFlows,
      passedFlows,
      failedFlows,
      coverage,
      flowDetails
    };
  }

  /**
   * Export report to JSON format
   */
  exportToJson(report: ErrorReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report to HTML format
   */
  exportToHtml(report: ErrorReport): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E2E Flow Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-card.error { background: #fee; }
        .summary-card.success { background: #efe; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px; }
        .error-list { background: #fff; border: 1px solid #ddd; border-radius: 4px; }
        .error-item { padding: 15px; border-bottom: 1px solid #eee; }
        .error-item:last-child { border-bottom: none; }
        .error-status { display: inline-block; padding: 2px 8px; border-radius: 3px; color: white; font-size: 12px; }
        .status-4xx { background: #ffc107; color: #000; }
        .status-5xx { background: #dc3545; }
        .recommendations { background: #e7f3ff; padding: 15px; border-radius: 4px; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .flow-coverage { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
        .coverage-stats { background: #f8f9fa; padding: 15px; border-radius: 4px; }
        .flow-details { background: #fff; border: 1px solid #ddd; border-radius: 4px; }
        .flow-item { padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .flow-item:last-child { border-bottom: none; }
        .flow-status { padding: 2px 8px; border-radius: 3px; font-size: 12px; }
        .status-passed { background: #28a745; color: white; }
        .status-failed { background: #dc3545; color: white; }
        .status-skipped { background: #6c757d; color: white; }
        .timestamp { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 E2E Flow Testing Report</h1>
            <p class="timestamp">Generated on ${report.generatedAt.toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="summary-card ${report.summary.totalErrors > 0 ? 'error' : 'success'}">
                <h3>${report.summary.totalErrors}</h3>
                <p>Total Errors</p>
            </div>
            <div class="summary-card ${report.summary.criticalErrors > 0 ? 'error' : 'success'}">
                <h3>${report.summary.criticalErrors}</h3>
                <p>Critical Errors</p>
            </div>
            <div class="summary-card">
                <h3>${report.summary.passedTests}/${report.summary.totalTests}</h3>
                <p>Tests Passed</p>
            </div>
            <div class="summary-card">
                <h3>${Math.round(report.flowCoverage.coverage)}%</h3>
                <p>Flow Coverage</p>
            </div>
        </div>

        ${report.recommendations.length > 0 ? `
        <div class="section">
            <h2>📋 Recommendations</h2>
            <div class="recommendations">
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
        ` : ''}

        ${Object.keys(report.errors.byEndpoint).length > 0 ? `
        <div class="section">
            <h2>🔍 Errors by Endpoint</h2>
            <div class="error-list">
                ${Object.entries(report.errors.byEndpoint).map(([endpoint, errors]) => `
                    <div class="error-item">
                        <h4>${endpoint} (${errors.length} errors)</h4>
                        ${errors.slice(0, 3).map(error => `
                            <div style="margin: 5px 0;">
                                <span class="error-status status-${Math.floor(error.response.status / 100)}xx">
                                    ${error.response.status}
                                </span>
                                ${error.request.method} - ${error.response.statusText}
                                <small style="color: #666;">(${error.timestamp.toLocaleTimeString()})</small>
                            </div>
                        `).join('')}
                        ${errors.length > 3 ? `<small>... and ${errors.length - 3} more</small>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2>📊 Flow Coverage</h2>
            <div class="flow-coverage">
                <div class="coverage-stats">
                    <h4>Coverage Statistics</h4>
                    <p><strong>Total Flows:</strong> ${report.flowCoverage.totalFlows}</p>
                    <p><strong>Tested:</strong> ${report.flowCoverage.testedFlows}</p>
                    <p><strong>Passed:</strong> ${report.flowCoverage.passedFlows}</p>
                    <p><strong>Failed:</strong> ${report.flowCoverage.failedFlows}</p>
                    <p><strong>Coverage:</strong> ${Math.round(report.flowCoverage.coverage)}%</p>
                </div>
                <div class="flow-details">
                    <h4>Flow Details</h4>
                    ${report.flowCoverage.flowDetails.map(flow => `
                        <div class="flow-item">
                            <div>
                                <strong>${flow.name}</strong>
                                <br>
                                <small>${flow.steps} steps, ${flow.duration}ms</small>
                            </div>
                            <span class="flow-status status-${flow.status}">${flow.status.toUpperCase()}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        ${report.uiElements.length > 0 ? `
        <div class="section">
            <h2>🎯 UI Element Status</h2>
            <div class="error-list">
                ${report.uiElements.map(element => `
                    <div class="error-item">
                        <h4>${element.element} (${element.page})</h4>
                        <p><strong>Selector:</strong> <code>${element.selector}</code></p>
                        <p><strong>Status:</strong> 
                            <span class="flow-status status-${element.status === 'working' ? 'passed' : element.status === 'broken' ? 'failed' : 'skipped'}">
                                ${element.status.toUpperCase()}
                            </span>
                        </p>
                        ${element.error ? `<p><strong>Error:</strong> ${element.error}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
    return html;
  }

  /**
   * Clear all collected data
   */
  clear(): void {
    this.uiElementTests = [];
    this.flowResults = [];
    this.evidence = [];
  }
}

/**
 * Create a new error reporter instance
 */
export function createErrorReporter(): ErrorReporter {
  return new ErrorReporter();
}