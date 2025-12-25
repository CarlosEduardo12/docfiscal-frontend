import { Page, Response } from '@playwright/test';

/**
 * Network error interface representing captured backend errors
 */
export interface NetworkError {
  id: string;
  timestamp: Date;
  flow: string;
  step: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  };
  category: 'client' | 'server' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Network logger for capturing backend errors during test execution
 */
export class NetworkLogger {
  private errors: NetworkError[] = [];
  private currentFlow: string = '';
  private currentStep: string = '';

  /**
   * Set the current flow context for error tracking
   */
  setFlowContext(flow: string, step: string = ''): void {
    this.currentFlow = flow;
    this.currentStep = step;
  }

  /**
   * Capture backend errors by monitoring HTTP responses with status >= 400
   */
  async captureBackendErrors(page: Page): Promise<void> {
    page.on('response', async (response: Response) => {
      if (response.status() >= 400) {
        try {
          const error = await this.createNetworkError(response);
          this.errors.push(error);
          console.warn(`🚨 Backend error captured: ${error.response.status} ${error.request.method} ${error.request.url}`);
        } catch (captureError) {
          console.error('Failed to capture network error:', captureError);
        }
      }
    });
  }

  /**
   * Create a structured network error from a response
   */
  private async createNetworkError(response: Response): Promise<NetworkError> {
    const request = response.request();
    const url = response.url();
    const method = request.method();
    const status = response.status();
    
    // Generate unique ID for the error
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Capture request headers
    const requestHeaders: Record<string, string> = {};
    const reqHeaders = await request.allHeaders();
    Object.keys(reqHeaders).forEach(key => {
      requestHeaders[key] = reqHeaders[key];
    });

    // Capture response headers
    const responseHeaders: Record<string, string> = {};
    const resHeaders = response.headers();
    Object.keys(resHeaders).forEach(key => {
      responseHeaders[key] = resHeaders[key];
    });

    // Capture request body if available
    let requestBody: any;
    try {
      const postData = request.postData();
      if (postData) {
        // Try to parse as JSON, fallback to string
        try {
          requestBody = JSON.parse(postData);
        } catch {
          requestBody = postData;
        }
      }
    } catch {
      requestBody = null;
    }

    // Capture response body if available
    let responseBody: any;
    try {
      const body = await response.text();
      if (body !== undefined) {
        if (body === '') {
          // Handle empty response body explicitly
          responseBody = '';
        } else {
          // Try to parse as JSON, fallback to string
          try {
            responseBody = JSON.parse(body);
          } catch {
            responseBody = body;
          }
        }
      } else {
        responseBody = null;
      }
    } catch {
      responseBody = null;
    }

    const error: NetworkError = {
      id,
      timestamp: new Date(),
      flow: this.currentFlow,
      step: this.currentStep,
      request: {
        url,
        method,
        headers: requestHeaders,
        body: requestBody
      },
      response: {
        status,
        statusText: response.statusText(),
        headers: responseHeaders,
        body: responseBody
      },
      category: this.categorizeError(status),
      severity: this.determineSeverity(status, url)
    };

    return error;
  }

  /**
   * Categorize error based on HTTP status code
   */
  categorizeError(status: number): 'client' | 'server' | 'network' {
    if (status >= 400 && status < 500) {
      return 'client';
    } else if (status >= 500 && status < 600) {
      return 'server';
    } else {
      return 'network';
    }
  }

  /**
   * Determine error severity based on status code and endpoint
   */
  private determineSeverity(status: number, url: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical endpoints that should never fail
    const criticalEndpoints = ['/api/auth/login', '/api/auth/register', '/api/orders'];
    const isCriticalEndpoint = criticalEndpoints.some(endpoint => url.includes(endpoint));

    if (status >= 500) {
      return isCriticalEndpoint ? 'critical' : 'high';
    } else if (status === 401 || status === 403) {
      return isCriticalEndpoint ? 'high' : 'medium';
    } else if (status === 404) {
      return isCriticalEndpoint ? 'medium' : 'low';
    } else {
      return 'low';
    }
  }

  /**
   * Get all captured errors
   */
  getErrors(): NetworkError[] {
    return [...this.errors];
  }

  /**
   * Get errors filtered by category
   */
  getErrorsByCategory(category: 'client' | 'server' | 'network'): NetworkError[] {
    return this.errors.filter(error => error.category === category);
  }

  /**
   * Get errors filtered by severity
   */
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): NetworkError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Check if any critical errors were captured
   */
  hasCriticalErrors(): boolean {
    return this.errors.some(error => error.severity === 'critical');
  }

  /**
   * Clear all captured errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Format error report for structured output
   */
  formatErrorReport(): {
    summary: {
      totalErrors: number;
      clientErrors: number;
      serverErrors: number;
      networkErrors: number;
      criticalErrors: number;
    };
    errors: NetworkError[];
  } {
    const clientErrors = this.getErrorsByCategory('client');
    const serverErrors = this.getErrorsByCategory('server');
    const networkErrors = this.getErrorsByCategory('network');
    const criticalErrors = this.getErrorsBySeverity('critical');

    return {
      summary: {
        totalErrors: this.errors.length,
        clientErrors: clientErrors.length,
        serverErrors: serverErrors.length,
        networkErrors: networkErrors.length,
        criticalErrors: criticalErrors.length
      },
      errors: this.errors
    };
  }
}

/**
 * Create a new network logger instance
 */
export function createNetworkLogger(): NetworkLogger {
  return new NetworkLogger();
}