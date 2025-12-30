/**
 * Authentication Logger
 * Provides comprehensive logging for all authentication operations
 * Validates Requirements 7.1, 7.2
 */

import { environmentConfig } from './environmentConfig';

export interface AuthLogEntry {
  timestamp: string;
  operation: string;
  status: 'success' | 'failure' | 'warning' | 'info';
  details: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface LoginAttemptDetails {
  email: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: string;
  result: 'success' | 'failure';
  failureReason?: string;
  duration: number;
}

export interface TokenOperationDetails {
  operation: 'store' | 'retrieve' | 'refresh' | 'validate' | 'clear';
  tokenType: 'access' | 'refresh' | 'both';
  result: 'success' | 'failure';
  reason?: string;
  tokenLength?: number;
  expiresAt?: string;
  duration: number;
}

export interface SessionDetails {
  operation: 'initialize' | 'restore' | 'persist' | 'destroy';
  result: 'success' | 'failure';
  hasTokens: boolean;
  tokensValid?: boolean;
  userProfile?: boolean;
  duration: number;
}

export interface AuthErrorDetails {
  errorType: 'network' | 'validation' | 'authentication' | 'authorization' | 'cors' | 'server' | 'client' | 'unknown';
  errorCode: string;
  errorMessage: string;
  operation: string;
  context?: Record<string, any>;
  stack?: string;
  httpStatus?: number;
  retryable: boolean;
}

export interface RedirectDetails {
  from: string;
  to: string;
  reason: string;
  method: 'router.push' | 'router.replace' | 'window.location' | 'safe_redirect';
  timestamp: string;
  wasAuthenticated: boolean;
  preventedLoop?: boolean;
}

class AuthLogger {
  private logs: AuthLogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries
  private sessionId: string;
  private isEnabled: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    const envConfig = environmentConfig.getConfig();
    this.isEnabled = envConfig.isDevelopment || envConfig.enableAuthLogging;
    
    if (this.isEnabled) {
      console.log('🔍 AuthLogger initialized with session ID:', this.sessionId);
    }
  }

  private generateSessionId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private createLogEntry(
    operation: string,
    status: AuthLogEntry['status'],
    details: Record<string, any>,
    error?: Error,
    duration?: number
  ): AuthLogEntry {
    const entry: AuthLogEntry = {
      timestamp: new Date().toISOString(),
      operation,
      status,
      details: {
        ...details,
        environment: environmentConfig.getConfig().environment,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      },
      sessionId: this.sessionId,
      requestId: this.generateRequestId(),
      duration,
    };

    if (error) {
      entry.error = {
        code: (error as any).code || 'UNKNOWN_ERROR',
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private addLog(entry: AuthLogEntry): void {
    if (!this.isEnabled) return;

    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console logging with appropriate level
    const logLevel = entry.status === 'failure' ? 'error' : 
                    entry.status === 'warning' ? 'warn' : 'log';
    
    const logMessage = `[AUTH] ${entry.operation} - ${entry.status.toUpperCase()}`;
    const logData = {
      timestamp: entry.timestamp,
      requestId: entry.requestId,
      details: entry.details,
      duration: entry.duration ? `${entry.duration}ms` : undefined,
      error: entry.error,
    };

    console[logLevel](logMessage, logData);
  }

  /**
   * Log login attempts with detailed information
   */
  logLoginAttempt(details: LoginAttemptDetails): void {
    const startTime = Date.now();
    
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
      details.duration
    ));

    // Track login patterns for security
    if (details.result === 'failure') {
      this.trackFailedLoginPattern(details.email);
    }
  }

  /**
   * Log token operations (store, retrieve, refresh, validate, clear)
   */
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

  /**
   * Log session operations (initialize, restore, persist, destroy)
   */
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

  /**
   * Log authentication state changes
   */
  logAuthStateChange(
    from: 'authenticated' | 'unauthenticated' | 'loading',
    to: 'authenticated' | 'unauthenticated' | 'loading',
    reason: string,
    userId?: string
  ): void {
    this.addLog(this.createLogEntry(
      'AUTH_STATE_CHANGE',
      'info',
      {
        fromState: from,
        toState: to,
        reason,
        userId,
        stateTransition: `${from} -> ${to}`,
      }
    ));
  }

  /**
   * Log profile fetch operations
   */
  logProfileFetch(
    result: 'success' | 'failure',
    userId?: string,
    error?: Error,
    duration?: number
  ): void {
    this.addLog(this.createLogEntry(
      'PROFILE_FETCH',
      result === 'success' ? 'success' : 'failure',
      {
        userId,
        hasUserId: !!userId,
      },
      error,
      duration
    ));
  }

  /**
   * Log logout operations
   */
  logLogout(
    result: 'success' | 'failure',
    reason: string,
    userId?: string,
    error?: Error,
    duration?: number
  ): void {
    this.addLog(this.createLogEntry(
      'LOGOUT',
      result === 'success' ? 'success' : 'failure',
      {
        reason,
        userId,
        hasUserId: !!userId,
      },
      error,
      duration
    ));
  }

  /**
   * Log authentication initialization
   */
  logAuthInitialization(
    result: 'success' | 'failure',
    hasValidSession: boolean,
    error?: Error,
    duration?: number
  ): void {
    this.addLog(this.createLogEntry(
      'AUTH_INITIALIZATION',
      result === 'success' ? 'success' : 'failure',
      {
        hasValidSession,
        pageLoad: true,
      },
      error,
      duration
    ));
  }

  /**
   * Log token validation operations
   */
  logTokenValidation(
    tokenType: 'access' | 'refresh',
    result: 'valid' | 'expired' | 'invalid' | 'corrupted',
    details?: {
      expiresAt?: string;
      timeUntilExpiry?: number;
      shouldRefresh?: boolean;
    },
    duration?: number
  ): void {
    this.addLog(this.createLogEntry(
      'TOKEN_VALIDATION',
      result === 'valid' ? 'success' : 
      result === 'expired' ? 'warning' : 'failure',
      {
        tokenType,
        validationResult: result,
        expiresAt: details?.expiresAt,
        timeUntilExpiry: details?.timeUntilExpiry,
        shouldRefresh: details?.shouldRefresh,
      },
      result === 'invalid' || result === 'corrupted' ? 
        new Error(`Token ${result}`) : undefined,
      duration
    ));
  }

  /**
   * Log token refresh operations
   */
  logTokenRefresh(
    result: 'success' | 'failure',
    reason?: string,
    newTokenLength?: number,
    error?: Error,
    duration?: number
  ): void {
    this.addLog(this.createLogEntry(
      'TOKEN_REFRESH',
      result === 'success' ? 'success' : 'failure',
      {
        reason,
        newTokenLength,
        refreshAttempt: true,
      },
      error,
      duration
    ));
  }

  /**
   * Track failed login patterns for security monitoring
   */
  private trackFailedLoginPattern(email: string): void {
    const recentFailures = this.logs
      .filter(log => 
        log.operation === 'LOGIN_ATTEMPT' && 
        log.status === 'failure' &&
        log.details.email === email &&
        Date.now() - new Date(log.timestamp).getTime() < 15 * 60 * 1000 // Last 15 minutes
      );

    if (recentFailures.length >= 3) {
      this.addLog(this.createLogEntry(
        'SECURITY_ALERT',
        'warning',
        {
          alertType: 'MULTIPLE_FAILED_LOGINS',
          email,
          failureCount: recentFailures.length,
          timeWindow: '15 minutes',
        }
      ));
    }
  }

  /**
   * Get authentication logs for debugging
   */
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

  /**
   * Get authentication statistics
   */
  getAuthStats(): {
    totalOperations: number;
    successfulLogins: number;
    failedLogins: number;
    tokenRefreshes: number;
    sessionRestores: number;
    averageLoginDuration: number;
    recentErrors: AuthLogEntry[];
  } {
    if (!this.isEnabled) {
      return {
        totalOperations: 0,
        successfulLogins: 0,
        failedLogins: 0,
        tokenRefreshes: 0,
        sessionRestores: 0,
        averageLoginDuration: 0,
        recentErrors: [],
      };
    }

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
        Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000 // Last hour
      )
      .slice(-10); // Last 10 errors

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

  /**
   * Export logs for debugging or support
   */
  exportLogs(): string {
    if (!this.isEnabled) {
      return JSON.stringify({ message: 'Logging is disabled' }, null, 2);
    }

    const exportData = {
      sessionId: this.sessionId,
      exportTimestamp: new Date().toISOString(),
      environment: environmentConfig.getConfig().environment,
      totalLogs: this.logs.length,
      stats: this.getAuthStats(),
      logs: this.logs,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear all logs (for privacy/memory management)
   */
  clearLogs(): void {
    this.logs = [];
    console.log('🧹 Authentication logs cleared');
  }

  /**
   * Log authentication errors with detailed information
   */
  logAuthError(details: AuthErrorDetails): void {
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
      new Error(details.errorMessage),
    ));

    // Track error patterns for monitoring
    this.trackErrorPattern(details);
  }

  /**
   * Log redirect operations with source and destination tracking
   */
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

    // Track redirect patterns to detect loops
    this.trackRedirectPattern(details);
  }

  /**
   * Log network errors with connection details
   */
  logNetworkError(
    operation: string,
    error: Error,
    details?: {
      url?: string;
      method?: string;
      status?: number;
      timeout?: boolean;
      offline?: boolean;
    }
  ): void {
    this.logAuthError({
      errorType: 'network',
      errorCode: details?.offline ? 'OFFLINE' : details?.timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: error.message,
      operation,
      context: {
        url: details?.url,
        method: details?.method,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        connectionType: this.getConnectionType(),
      },
      stack: error.stack,
      httpStatus: details?.status,
      retryable: !details?.offline && details?.status !== 404,
    });
  }

  /**
   * Log CORS errors with diagnostic information
   */
  logCorsError(
    operation: string,
    error: Error,
    details?: {
      url?: string;
      method?: string;
      origin?: string;
      allowedOrigins?: string[];
    }
  ): void {
    this.logAuthError({
      errorType: 'cors',
      errorCode: 'CORS_ERROR',
      errorMessage: error.message,
      operation,
      context: {
        url: details?.url,
        method: details?.method,
        origin: details?.origin || (typeof window !== 'undefined' ? window.location.origin : undefined),
        allowedOrigins: details?.allowedOrigins,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
      stack: error.stack,
      retryable: false,
    });
  }

  /**
   * Log validation errors with field details
   */
  logValidationError(
    operation: string,
    error: Error,
    details?: {
      field?: string;
      value?: any;
      constraint?: string;
    }
  ): void {
    this.logAuthError({
      errorType: 'validation',
      errorCode: 'VALIDATION_ERROR',
      errorMessage: error.message,
      operation,
      context: {
        field: details?.field,
        valueType: details?.value ? typeof details.value : undefined,
        constraint: details?.constraint,
      },
      stack: error.stack,
      retryable: false,
    });
  }

  /**
   * Log server errors with response details
   */
  logServerError(
    operation: string,
    error: Error,
    details?: {
      status?: number;
      statusText?: string;
      responseBody?: any;
      requestId?: string;
    }
  ): void {
    this.logAuthError({
      errorType: 'server',
      errorCode: `HTTP_${details?.status || 'UNKNOWN'}`,
      errorMessage: error.message,
      operation,
      context: {
        status: details?.status,
        statusText: details?.statusText,
        responseBody: details?.responseBody,
        requestId: details?.requestId,
      },
      stack: error.stack,
      httpStatus: details?.status,
      retryable: details?.status ? details.status >= 500 : false,
    });
  }

  /**
   * Classify error severity for monitoring
   */
  private classifyErrorSeverity(error: AuthErrorDetails): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Authentication failures, token corruption
    if (error.errorType === 'authentication' || error.errorCode.includes('CORRUPTED')) {
      return 'critical';
    }

    // High: Authorization failures, CORS issues
    if (error.errorType === 'authorization' || error.errorType === 'cors') {
      return 'high';
    }

    // Medium: Network issues, server errors
    if (error.errorType === 'network' || error.errorType === 'server') {
      return 'medium';
    }

    // Low: Validation errors, client errors
    return 'low';
  }

  /**
   * Track error patterns for security monitoring
   */
  private trackErrorPattern(error: AuthErrorDetails): void {
    const recentErrors = this.logs
      .filter(log => 
        log.operation === 'AUTH_ERROR' && 
        log.details.errorType === error.errorType &&
        Date.now() - new Date(log.timestamp).getTime() < 10 * 60 * 1000 // Last 10 minutes
      );

    if (recentErrors.length >= 5) {
      this.addLog(this.createLogEntry(
        'SECURITY_ALERT',
        'warning',
        {
          alertType: 'REPEATED_AUTH_ERRORS',
          errorType: error.errorType,
          errorCount: recentErrors.length,
          timeWindow: '10 minutes',
          pattern: 'high_error_frequency',
        }
      ));
    }
  }

  /**
   * Track redirect patterns to detect loops
   */
  private trackRedirectPattern(redirect: RedirectDetails): void {
    const recentRedirects = this.logs
      .filter(log => 
        log.operation === 'REDIRECT' &&
        Date.now() - new Date(log.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
      );

    // Check for redirect loops
    const samePathRedirects = recentRedirects.filter(log =>
      log.details.from === redirect.from && log.details.to === redirect.to
    );

    if (samePathRedirects.length >= 3) {
      this.addLog(this.createLogEntry(
        'SECURITY_ALERT',
        'warning',
        {
          alertType: 'REDIRECT_LOOP_DETECTED',
          from: redirect.from,
          to: redirect.to,
          loopCount: samePathRedirects.length,
          timeWindow: '5 minutes',
          pattern: 'redirect_loop',
        }
      ));
    }

    // Check for excessive redirects
    if (recentRedirects.length >= 10) {
      this.addLog(this.createLogEntry(
        'SECURITY_ALERT',
        'warning',
        {
          alertType: 'EXCESSIVE_REDIRECTS',
          redirectCount: recentRedirects.length,
          timeWindow: '5 minutes',
          pattern: 'excessive_redirects',
        }
      ));
    }
  }

  /**
   * Get connection type information
   */
  private getConnectionType(): string | undefined {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection?.effectiveType || connection?.type || 'unknown';
    }
    return undefined;
  }

  /**
   * Set user ID for current session (after successful login)
   */
  setUserId(userId: string): void {
    // Update recent logs with user ID
    const recentLogs = this.logs.filter(log => 
      Date.now() - new Date(log.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    recentLogs.forEach(log => {
      if (!log.userId) {
        log.userId = userId;
      }
    });

    this.addLog(this.createLogEntry(
      'USER_ID_SET',
      'info',
      {
        userId,
        updatedRecentLogs: recentLogs.length,
      }
    ));
  }

  /**
   * Get error statistics for monitoring
   */
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
    if (!this.isEnabled) {
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        recentCriticalErrors: [],
        errorTrends: {
          lastHour: 0,
          lastDay: 0,
          mostCommonError: 'none',
        },
      };
    }

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

  /**
   * Get redirect statistics for monitoring
   */
  getRedirectStats(): {
    totalRedirects: number;
    redirectsByReason: Record<string, number>;
    loopPrevented: number;
    recentRedirects: AuthLogEntry[];
    redirectPatterns: {
      mostCommonPath: string;
      averageRedirectsPerSession: number;
    };
  } {
    if (!this.isEnabled) {
      return {
        totalRedirects: 0,
        redirectsByReason: {},
        loopPrevented: 0,
        recentRedirects: [],
        redirectPatterns: {
          mostCommonPath: 'none',
          averageRedirectsPerSession: 0,
        },
      };
    }

    const redirectLogs = this.logs.filter(log => log.operation === 'REDIRECT');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const redirectsByReason: Record<string, number> = {};
    const pathCounts: Record<string, number> = {};
    let loopPrevented = 0;

    redirectLogs.forEach(log => {
      const reason = log.details.reason || 'unknown';
      const pathChange = log.details.pathChange || 'unknown';

      redirectsByReason[reason] = (redirectsByReason[reason] || 0) + 1;
      pathCounts[pathChange] = (pathCounts[pathChange] || 0) + 1;

      if (log.details.preventedLoop) {
        loopPrevented++;
      }
    });

    const mostCommonPath = Object.entries(pathCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    const recentRedirects = redirectLogs
      .filter(log => now - new Date(log.timestamp).getTime() < oneHour)
      .slice(-10);

    return {
      totalRedirects: redirectLogs.length,
      redirectsByReason,
      loopPrevented,
      recentRedirects,
      redirectPatterns: {
        mostCommonPath,
        averageRedirectsPerSession: redirectLogs.length / Math.max(1, this.logs.filter(log => log.operation === 'LOGIN_ATTEMPT' && log.status === 'success').length),
      },
    };
  }
}

// Export singleton instance
export const authLogger = new AuthLogger();