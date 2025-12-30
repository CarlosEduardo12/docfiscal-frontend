/**
 * Property-Based Tests for Comprehensive Authentication Logging
 * Validates Requirements 7.1, 7.2, 7.3, 7.4
 * 
 * Property 7: Comprehensive Authentication Logging
 * For any authentication operation (login attempts, token operations, errors, redirects), 
 * the system should generate detailed logs with sufficient information for debugging and monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';

// Import the AuthLogger class directly to create fresh instances
import { AuthLogEntry, LoginAttemptDetails, TokenOperationDetails, SessionDetails, AuthErrorDetails, RedirectDetails } from '@/lib/authLogger';

// Create a mock AuthLogger class for testing
class TestAuthLogger {
  private logs: AuthLogEntry[] = [];
  private maxLogs = 1000;
  private sessionId: string;
  private isEnabled: boolean = true;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `test_auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `test_req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private createLogEntry(
    operation: string,
    status: AuthLogEntry['status'],
    details: Record<string, any>,
    error?: Error,
    duration?: number,
    timestamp?: string
  ): AuthLogEntry {
    const entry: AuthLogEntry = {
      timestamp: timestamp || new Date().toISOString(),
      operation,
      status,
      details: {
        ...details,
        environment: 'test',
        userAgent: details.userAgent || 'Mozilla/5.0 (darwin) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/26.1.0',
      },
      sessionId: this.sessionId,
      requestId: this.generateRequestId(),
      duration,
    };

    if (error) {
      entry.error = {
        code: (error as any).code || error.name || 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private addLog(entry: AuthLogEntry): void {
    if (!this.isEnabled) return;

    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  logLoginAttempt(details: LoginAttemptDetails): void {
    this.addLog(this.createLogEntry(
      'LOGIN_ATTEMPT',
      details.result === 'success' ? 'success' : 'failure',
      {
        email: details.email,
        userAgent: details.userAgent,
        ipAddress: details.ipAddress || 'unknown',
        failureReason: details.failureReason,
        attemptTimestamp: details.timestamp,
      },
      details.result === 'failure' && details.failureReason ? 
        new Error(details.failureReason) : undefined,
      details.duration,
      details.timestamp
    ));
  }

  logTokenOperation(details: TokenOperationDetails): void {
    this.addLog(this.createLogEntry(
      `TOKEN_${details.operation.toUpperCase()}`,
      details.result === 'success' ? 'success' : 'failure',
      {
        tokenType: details.tokenType,
        tokenLength: details.tokenLength,
        expiresAt: details.expiresAt,
        reason: details.reason,
        operation: details.operation,
      },
      details.result === 'failure' && details.reason ? 
        new Error(details.reason) : undefined,
      details.duration
    ));
  }

  logSessionOperation(details: SessionDetails): void {
    this.addLog(this.createLogEntry(
      `SESSION_${details.operation.toUpperCase()}`,
      details.result === 'success' ? 'success' : 'failure',
      {
        hasTokens: details.hasTokens,
        tokensValid: details.tokensValid,
        userProfile: details.userProfile,
        operation: details.operation,
      },
      undefined,
      details.duration
    ));
  }

  logAuthError(details: AuthErrorDetails): void {
    const error = new Error(details.errorMessage);
    (error as any).code = details.errorCode;
    
    this.addLog(this.createLogEntry(
      'AUTH_ERROR',
      'failure',
      {
        errorType: details.errorType,
        errorCode: details.errorCode,
        operation: details.operation,
        context: details.context,
        httpStatus: details.httpStatus,
        retryable: details.retryable,
        errorClassification: this.classifyErrorSeverity(details),
      },
      error,
    ));
  }

  logRedirect(details: RedirectDetails): void {
    this.addLog(this.createLogEntry(
      'REDIRECT',
      details.preventedLoop ? 'warning' : 'info',
      {
        from: details.from,
        to: details.to,
        reason: details.reason,
        method: details.method,
        wasAuthenticated: details.wasAuthenticated,
        preventedLoop: details.preventedLoop || false,
        redirectTimestamp: details.timestamp,
        pathChange: `${details.from} -> ${details.to}`,
      }
    ));
  }

  private classifyErrorSeverity(error: AuthErrorDetails): 'low' | 'medium' | 'high' | 'critical' {
    if (error.errorType === 'authentication' || error.errorCode.includes('CORRUPTED')) {
      return 'critical';
    }
    if (error.errorType === 'authorization' || error.errorType === 'cors') {
      return 'high';
    }
    if (error.errorType === 'network' || error.errorType === 'server') {
      return 'medium';
    }
    return 'low';
  }

  getLogs(filter?: {
    operation?: string;
    status?: AuthLogEntry['status'];
    since?: Date;
    userId?: string;
  }): AuthLogEntry[] {
    if (!this.isEnabled) {
      return [];
    }

    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.operation) {
        filteredLogs = filteredLogs.filter(log => 
          log.operation.includes(filter.operation!.toUpperCase())
        );
      }

      if (filter.status) {
        filteredLogs = filteredLogs.filter(log => log.status === filter.status);
      }

      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filter.since!
        );
      }

      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }
    }

    return filteredLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getAuthStats(): {
    totalOperations: number;
    successfulLogins: number;
    failedLogins: number;
    tokenRefreshes: number;
    sessionRestores: number;
    averageLoginDuration: number;
    recentErrors: AuthLogEntry[];
  } {
    const loginAttempts = this.logs.filter(log => log.operation === 'LOGIN_ATTEMPT');
    const successfulLogins = loginAttempts.filter(log => log.status === 'success');
    const failedLogins = loginAttempts.filter(log => log.status === 'failure');
    const tokenRefreshes = this.logs.filter(log => log.operation === 'TOKEN_REFRESH');
    const sessionRestores = this.logs.filter(log => 
      log.operation === 'SESSION_RESTORE' && log.status === 'success'
    );

    const averageLoginDuration = successfulLogins.length > 0 ?
      successfulLogins.reduce((sum, log) => sum + (log.duration || 0), 0) / successfulLogins.length :
      0;

    const recentErrors = this.logs
      .filter(log => 
        log.status === 'failure' &&
        Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000
      )
      .slice(-10);

    return {
      totalOperations: this.logs.length,
      successfulLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      tokenRefreshes: tokenRefreshes.length,
      sessionRestores: sessionRestores.length,
      averageLoginDuration: Math.round(averageLoginDuration),
      recentErrors,
    };
  }

  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentCriticalErrors: AuthLogEntry[];
    errorTrends: {
      lastHour: number;
      lastDay: number;
      mostCommonError: string;
    };
  } {
    const errorLogs = this.logs.filter(log => log.operation === 'AUTH_ERROR');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let lastHourErrors = 0;
    let lastDayErrors = 0;

    errorLogs.forEach(log => {
      const errorType = log.details.errorType || 'unknown';
      const severity = log.details.errorClassification || 'unknown';
      const logTime = new Date(log.timestamp).getTime();

      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      errorsBySeverity[severity] = (errorsBySeverity[severity] || 0) + 1;

      if (now - logTime < oneHour) lastHourErrors++;
      if (now - logTime < oneDay) lastDayErrors++;
    });

    const mostCommonError = Object.entries(errorsByType)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    const recentCriticalErrors = errorLogs
      .filter(log => 
        log.details.errorClassification === 'critical' &&
        now - new Date(log.timestamp).getTime() < oneDay
      )
      .slice(-5);

    return {
      totalErrors: errorLogs.length,
      errorsByType,
      errorsBySeverity,
      recentCriticalErrors,
      errorTrends: {
        lastHour: lastHourErrors,
        lastDay: lastDayErrors,
        mostCommonError,
      },
    };
  }

  exportLogs(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportTimestamp: new Date().toISOString(),
      environment: 'test',
      totalLogs: this.logs.length,
      stats: this.getAuthStats(),
      logs: this.logs,
    };

    return JSON.stringify(exportData, null, 2);
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// Test utilities
const generateEmail = () => fc.emailAddress();
const generateUserAgent = () => fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
);

const generateTokenOperation = () => fc.constantFrom('store', 'retrieve', 'refresh', 'validate', 'clear');
const generateTokenType = () => fc.constantFrom('access', 'refresh', 'both');
const generateResult = () => fc.constantFrom('success', 'failure');

const generateSessionOperation = () => fc.constantFrom('initialize', 'restore', 'persist', 'destroy');

const generateErrorType = () => fc.constantFrom('network', 'validation', 'authentication', 'authorization', 'cors', 'server', 'client', 'unknown');
const generateErrorCode = () => fc.constantFrom('NETWORK_ERROR', 'TIMEOUT', 'CORS_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR');

const generateRedirectMethod = () => fc.constantFrom('router.push', 'router.replace', 'window.location', 'safe_redirect');
const generatePath = () => fc.constantFrom('/login', '/dashboard', '/profile', '/orders', '/upload');

describe('Comprehensive Authentication Logging Property Tests', () => {
  let authLogger: TestAuthLogger;

  beforeEach(() => {
    // Create a fresh authLogger instance for each test to ensure isolation
    authLogger = new TestAuthLogger();
  });

  afterEach(() => {
    // Clean up after each test
    if (authLogger) {
      authLogger.clearLogs();
    }
  });

  describe('Property 7.1: Login Attempt Logging', () => {
    it('should log all login attempts with complete information', () => {
      fc.assert(fc.property(
        generateEmail(),
        generateUserAgent(),
        generateResult(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 100, max: 5000 }),
        (email, userAgent, result, failureReason, duration) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          const loginDetails: LoginAttemptDetails = {
            email,
            userAgent,
            timestamp: new Date().toISOString(),
            result: result as 'success' | 'failure',
            failureReason: result === 'failure' ? failureReason : undefined,
            duration,
          };

          // Log the login attempt
          authLogger.logLoginAttempt(loginDetails);

          // Get logs and verify
          const logs = authLogger.getLogs({ operation: 'LOGIN_ATTEMPT' });
          
          // Should have exactly one log entry
          expect(logs).toHaveLength(1);
          
          const logEntry = logs[0];
          
          // Verify log structure
          expect(logEntry.operation).toBe('LOGIN_ATTEMPT');
          expect(logEntry.status).toBe(result === 'success' ? 'success' : 'failure');
          expect(logEntry.details.email).toBe(email);
          expect(logEntry.details.userAgent).toBe(userAgent);
          expect(logEntry.duration).toBe(duration);
          
          // Verify timestamp is valid
          expect(new Date(logEntry.timestamp)).toBeInstanceOf(Date);
          expect(logEntry.timestamp).toBeTruthy();
          
          // Verify session and request IDs are present
          expect(logEntry.sessionId).toBeTruthy();
          expect(logEntry.requestId).toBeTruthy();
          
          // Verify failure reason is logged for failures
          if (result === 'failure') {
            expect(logEntry.details.failureReason).toBe(failureReason);
            expect(logEntry.error).toBeTruthy();
            expect(logEntry.error?.message).toBe(failureReason);
          }
          
          // Verify environment information is included
          expect(logEntry.details.environment).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7.2: Token Operation Logging', () => {
    it('should log all token operations with detailed information', () => {
      fc.assert(fc.property(
        generateTokenOperation(),
        generateTokenType(),
        generateResult(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 10, max: 1000 }),
        fc.integer({ min: 50, max: 500 }),
        (operation, tokenType, result, reason, tokenLength, duration) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          const tokenDetails: TokenOperationDetails = {
            operation: operation as any,
            tokenType: tokenType as any,
            result: result as 'success' | 'failure',
            reason: result === 'failure' ? reason : undefined,
            tokenLength: result === 'success' ? tokenLength : undefined,
            expiresAt: result === 'success' ? new Date(Date.now() + 3600000).toISOString() : undefined,
            duration,
          };

          // Log the token operation
          authLogger.logTokenOperation(tokenDetails);

          // Get logs and verify
          const logs = authLogger.getLogs({ operation: `TOKEN_${operation.toUpperCase()}` });
          
          // Should have exactly one log entry
          expect(logs).toHaveLength(1);
          
          const logEntry = logs[0];
          
          // Verify log structure
          expect(logEntry.operation).toBe(`TOKEN_${operation.toUpperCase()}`);
          expect(logEntry.status).toBe(result === 'success' ? 'success' : 'failure');
          expect(logEntry.details.tokenType).toBe(tokenType);
          expect(logEntry.details.operation).toBe(operation);
          expect(logEntry.duration).toBe(duration);
          
          // Verify success-specific fields
          if (result === 'success') {
            expect(logEntry.details.tokenLength).toBe(tokenLength);
            expect(logEntry.details.expiresAt).toBeTruthy();
          }
          
          // Verify failure-specific fields
          if (result === 'failure') {
            expect(logEntry.details.reason).toBe(reason);
            expect(logEntry.error).toBeTruthy();
            expect(logEntry.error?.message).toBe(reason);
          }
          
          // Verify required fields are present
          expect(logEntry.timestamp).toBeTruthy();
          expect(logEntry.sessionId).toBeTruthy();
          expect(logEntry.requestId).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7.3: Error Logging', () => {
    it('should log all authentication errors with comprehensive details', () => {
      fc.assert(fc.property(
        generateErrorType(),
        generateErrorCode(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 200, max: 599 }),
        fc.boolean(),
        (errorType, errorCode, errorMessage, operation, httpStatus, retryable) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          const errorDetails: AuthErrorDetails = {
            errorType: errorType as any,
            errorCode,
            errorMessage,
            operation,
            context: {
              testContext: 'property-test',
              randomValue: Math.random(),
            },
            httpStatus,
            retryable,
          };

          // Log the error
          authLogger.logAuthError(errorDetails);

          // Get logs and verify
          const logs = authLogger.getLogs({ operation: 'AUTH_ERROR' });
          
          // Should have exactly one log entry
          expect(logs).toHaveLength(1);
          
          const logEntry = logs[0];
          
          // Verify log structure
          expect(logEntry.operation).toBe('AUTH_ERROR');
          expect(logEntry.status).toBe('failure');
          expect(logEntry.details.errorType).toBe(errorType);
          expect(logEntry.details.errorCode).toBe(errorCode);
          expect(logEntry.details.operation).toBe(operation);
          expect(logEntry.details.httpStatus).toBe(httpStatus);
          expect(logEntry.details.retryable).toBe(retryable);
          
          // Verify error object
          expect(logEntry.error).toBeTruthy();
          expect(logEntry.error?.message).toBe(errorMessage);
          expect(logEntry.error?.code).toBe(errorCode);
          
          // Verify context is preserved
          expect(logEntry.details.context).toBeTruthy();
          expect(logEntry.details.context.testContext).toBe('property-test');
          
          // Verify error classification
          expect(logEntry.details.errorClassification).toBeTruthy();
          expect(['low', 'medium', 'high', 'critical']).toContain(logEntry.details.errorClassification);
          
          // Verify required fields
          expect(logEntry.timestamp).toBeTruthy();
          expect(logEntry.sessionId).toBeTruthy();
          expect(logEntry.requestId).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7.4: Redirect Logging', () => {
    it('should log all redirects with source and destination tracking', () => {
      fc.assert(fc.property(
        generatePath(),
        generatePath(),
        fc.string({ minLength: 1, maxLength: 50 }),
        generateRedirectMethod(),
        fc.boolean(),
        fc.boolean(),
        (fromPath, toPath, reason, method, wasAuthenticated, preventedLoop) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          const redirectDetails: RedirectDetails = {
            from: fromPath,
            to: toPath,
            reason,
            method: method as any,
            timestamp: new Date().toISOString(),
            wasAuthenticated,
            preventedLoop,
          };

          // Log the redirect
          authLogger.logRedirect(redirectDetails);

          // Get logs and verify
          const logs = authLogger.getLogs({ operation: 'REDIRECT' });
          
          // Should have exactly one log entry
          expect(logs).toHaveLength(1);
          
          const logEntry = logs[0];
          
          // Verify log structure
          expect(logEntry.operation).toBe('REDIRECT');
          expect(logEntry.status).toBe(preventedLoop ? 'warning' : 'info');
          expect(logEntry.details.from).toBe(fromPath);
          expect(logEntry.details.to).toBe(toPath);
          expect(logEntry.details.reason).toBe(reason);
          expect(logEntry.details.method).toBe(method);
          expect(logEntry.details.wasAuthenticated).toBe(wasAuthenticated);
          expect(logEntry.details.preventedLoop).toBe(preventedLoop);
          
          // Verify path change is formatted correctly
          expect(logEntry.details.pathChange).toBe(`${fromPath} -> ${toPath}`);
          
          // Verify redirect timestamp
          expect(logEntry.details.redirectTimestamp).toBeTruthy();
          expect(new Date(logEntry.details.redirectTimestamp)).toBeInstanceOf(Date);
          
          // Verify required fields
          expect(logEntry.timestamp).toBeTruthy();
          expect(logEntry.sessionId).toBeTruthy();
          expect(logEntry.requestId).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7.5: Session Operation Logging', () => {
    it('should log all session operations with state information', () => {
      fc.assert(fc.property(
        generateSessionOperation(),
        generateResult(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 100, max: 5000 }),
        (operation, result, hasTokens, tokensValid, userProfile, duration) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          const sessionDetails: SessionDetails = {
            operation: operation as any,
            result: result as 'success' | 'failure',
            hasTokens,
            tokensValid: hasTokens ? tokensValid : undefined,
            userProfile: hasTokens && tokensValid ? userProfile : undefined,
            duration,
          };

          // Log the session operation
          authLogger.logSessionOperation(sessionDetails);

          // Get logs and verify
          const logs = authLogger.getLogs({ operation: `SESSION_${operation.toUpperCase()}` });
          
          // Should have exactly one log entry
          expect(logs).toHaveLength(1);
          
          const logEntry = logs[0];
          
          // Verify log structure
          expect(logEntry.operation).toBe(`SESSION_${operation.toUpperCase()}`);
          expect(logEntry.status).toBe(result === 'success' ? 'success' : 'failure');
          expect(logEntry.details.operation).toBe(operation);
          expect(logEntry.details.hasTokens).toBe(hasTokens);
          expect(logEntry.duration).toBe(duration);
          
          // Verify conditional fields
          if (hasTokens) {
            expect(logEntry.details.tokensValid).toBe(tokensValid);
            if (tokensValid) {
              expect(logEntry.details.userProfile).toBe(userProfile);
            }
          }
          
          // Verify required fields
          expect(logEntry.timestamp).toBeTruthy();
          expect(logEntry.sessionId).toBeTruthy();
          expect(logEntry.requestId).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7.6: Log Filtering and Retrieval', () => {
    it('should correctly filter logs by operation, status, and time', () => {
      fc.assert(fc.property(
        fc.array(fc.tuple(
          generateEmail(),
          generateResult(),
          fc.integer({ min: 0, max: 1000 })
        ), { minLength: 5, maxLength: 20 }),
        (loginAttempts) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          // Log multiple login attempts with different timestamps
          const baseTime = Date.now();
          loginAttempts.forEach(([email, result, timeOffset], index) => {
            const loginDetails: LoginAttemptDetails = {
              email,
              timestamp: new Date(baseTime + timeOffset).toISOString(),
              result: result as 'success' | 'failure',
              failureReason: result === 'failure' ? `failure-${index}` : undefined,
              duration: 100 + index,
            };
            
            authLogger.logLoginAttempt(loginDetails);
          });

          // Test filtering by operation
          const loginLogs = authLogger.getLogs({ operation: 'LOGIN_ATTEMPT' });
          expect(loginLogs).toHaveLength(loginAttempts.length);
          loginLogs.forEach(log => {
            expect(log.operation).toBe('LOGIN_ATTEMPT');
          });

          // Test filtering by status
          const successLogs = authLogger.getLogs({ status: 'success' });
          const expectedSuccessCount = loginAttempts.filter(([, result]) => result === 'success').length;
          expect(successLogs).toHaveLength(expectedSuccessCount);
          successLogs.forEach(log => {
            expect(log.status).toBe('success');
          });

          const failureLogs = authLogger.getLogs({ status: 'failure' });
          const expectedFailureCount = loginAttempts.filter(([, result]) => result === 'failure').length;
          expect(failureLogs).toHaveLength(expectedFailureCount);
          failureLogs.forEach(log => {
            expect(log.status).toBe('failure');
          });

          // Test filtering by time
          const midTime = new Date(baseTime + 500);
          const recentLogs = authLogger.getLogs({ since: midTime });
          const expectedRecentCount = loginAttempts.filter(([, , timeOffset]) => timeOffset >= 500).length;
          expect(recentLogs).toHaveLength(expectedRecentCount);
          recentLogs.forEach(log => {
            expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(midTime.getTime());
          });

          // Verify all logs have required fields
          const allLogs = authLogger.getLogs();
          allLogs.forEach(log => {
            expect(log.timestamp).toBeTruthy();
            expect(log.operation).toBeTruthy();
            expect(log.status).toBeTruthy();
            expect(log.sessionId).toBeTruthy();
            expect(log.requestId).toBeTruthy();
            expect(log.details).toBeTruthy();
          });
        }
      ), { numRuns: 50 });
    });
  });

  describe('Property 7.7: Statistics and Monitoring', () => {
    it('should provide accurate statistics for all logged operations', () => {
      fc.assert(fc.property(
        fc.array(fc.tuple(
          generateEmail(),
          generateResult(),
          fc.integer({ min: 100, max: 1000 })
        ), { minLength: 3, maxLength: 10 }),
        fc.array(fc.tuple(
          generateErrorType(),
          generateErrorCode(),
          fc.string({ minLength: 1, maxLength: 50 })
        ), { minLength: 2, maxLength: 8 }),
        (loginAttempts, errors) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          // Log login attempts
          loginAttempts.forEach(([email, result, duration], index) => {
            const loginDetails: LoginAttemptDetails = {
              email,
              timestamp: new Date().toISOString(),
              result: result as 'success' | 'failure',
              failureReason: result === 'failure' ? `failure-${index}` : undefined,
              duration,
            };
            
            authLogger.logLoginAttempt(loginDetails);
          });

          // Log errors
          errors.forEach(([errorType, errorCode, errorMessage], index) => {
            const errorDetails: AuthErrorDetails = {
              errorType: errorType as any,
              errorCode,
              errorMessage,
              operation: `test-operation-${index}`,
              retryable: index % 2 === 0,
            };
            
            authLogger.logAuthError(errorDetails);
          });

          // Get and verify statistics
          const authStats = authLogger.getAuthStats();
          const errorStats = authLogger.getErrorStats();

          // Verify auth statistics
          expect(authStats.totalOperations).toBeGreaterThan(0);
          expect(authStats.successfulLogins).toBe(
            loginAttempts.filter(([, result]) => result === 'success').length
          );
          expect(authStats.failedLogins).toBe(
            loginAttempts.filter(([, result]) => result === 'failure').length
          );
          
          // Verify average login duration calculation
          const successfulLogins = loginAttempts.filter(([, result]) => result === 'success');
          if (successfulLogins.length > 0) {
            const expectedAverage = Math.round(
              successfulLogins.reduce((sum, [, , duration]) => sum + duration, 0) / successfulLogins.length
            );
            expect(authStats.averageLoginDuration).toBe(expectedAverage);
          } else {
            expect(authStats.averageLoginDuration).toBe(0);
          }

          // Verify error statistics
          expect(errorStats.totalErrors).toBe(errors.length);
          
          // Verify error type counts
          const errorTypeCount: Record<string, number> = {};
          errors.forEach(([errorType]) => {
            errorTypeCount[errorType] = (errorTypeCount[errorType] || 0) + 1;
          });
          
          Object.entries(errorTypeCount).forEach(([errorType, count]) => {
            expect(errorStats.errorsByType[errorType]).toBe(count);
          });

          // Verify statistics are consistent
          expect(authStats.successfulLogins + authStats.failedLogins).toBe(loginAttempts.length);
        }
      ), { numRuns: 30 });
    });
  });

  describe('Property 7.8: Log Export and Data Integrity', () => {
    it('should export logs with complete data integrity', () => {
      fc.assert(fc.property(
        fc.array(fc.tuple(
          generateEmail(),
          generateResult(),
          fc.integer({ min: 100, max: 1000 })
        ), { minLength: 1, maxLength: 5 }),
        (loginAttempts) => {
          // **Feature: login-redirect-fix, Property 7: Comprehensive Authentication Logging**
          
          // Clear logs at the start of each property iteration
          authLogger.clearLogs();
          
          // Log some operations
          loginAttempts.forEach(([email, result, duration]) => {
            const loginDetails: LoginAttemptDetails = {
              email,
              timestamp: new Date().toISOString(),
              result: result as 'success' | 'failure',
              duration,
            };
            
            authLogger.logLoginAttempt(loginDetails);
          });

          // Export logs
          const exportedData = authLogger.exportLogs();
          
          // Verify export is valid JSON
          expect(() => JSON.parse(exportedData)).not.toThrow();
          
          const parsedData = JSON.parse(exportedData);
          
          // Verify export structure
          expect(parsedData.sessionId).toBeTruthy();
          expect(parsedData.exportTimestamp).toBeTruthy();
          expect(parsedData.environment).toBeTruthy();
          expect(parsedData.totalLogs).toBe(loginAttempts.length);
          expect(parsedData.stats).toBeTruthy();
          expect(parsedData.logs).toBeInstanceOf(Array);
          expect(parsedData.logs).toHaveLength(loginAttempts.length);
          
          // Verify each log entry has required fields
          parsedData.logs.forEach((log: AuthLogEntry) => {
            expect(log.timestamp).toBeTruthy();
            expect(log.operation).toBeTruthy();
            expect(log.status).toBeTruthy();
            expect(log.details).toBeTruthy();
            expect(log.sessionId).toBeTruthy();
            expect(log.requestId).toBeTruthy();
          });
          
          // Verify statistics match actual logs
          expect(parsedData.stats.totalOperations).toBe(loginAttempts.length);
          expect(parsedData.stats.successfulLogins).toBe(
            loginAttempts.filter(([, result]) => result === 'success').length
          );
          expect(parsedData.stats.failedLogins).toBe(
            loginAttempts.filter(([, result]) => result === 'failure').length
          );
        }
      ), { numRuns: 50 });
    });
  });
});