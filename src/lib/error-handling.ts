/**
 * Comprehensive error handling utilities
 * Implements Requirements 7.4 for graceful error handling and recovery
 */

// Error types for better error categorization
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  UPLOAD = 'UPLOAD',
  PAYMENT = 'PAYMENT',
  UNKNOWN = 'UNKNOWN',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Custom error class with additional context
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly errorId: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.errorId = `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.retryable = retryable;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Network error class
export class NetworkError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.NETWORK, ErrorSeverity.MEDIUM, context, true);
    this.name = 'NetworkError';
  }
}

// Validation error class
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.VALIDATION, ErrorSeverity.LOW, context, false);
    this.name = 'ValidationError';
  }
}

// Authentication error class
export class AuthenticationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      ErrorSeverity.HIGH,
      context,
      false
    );
    this.name = 'AuthenticationError';
  }
}

// Upload error class
export class UploadError extends AppError {
  constructor(
    message: string,
    context?: Record<string, any>,
    retryable: boolean = true
  ) {
    super(message, ErrorType.UPLOAD, ErrorSeverity.MEDIUM, context, retryable);
    this.name = 'UploadError';
  }
}

// Payment error class
export class PaymentError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, ErrorType.PAYMENT, ErrorSeverity.HIGH, context, false);
    this.name = 'PaymentError';
  }
}

// Error classification utility
export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Network errors
    if (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('connection')
    ) {
      return new NetworkError(error.message, { originalError: error.message });
    }

    // Authentication errors
    if (
      error.message.includes('unauthorized') ||
      error.message.includes('authentication') ||
      error.message.includes('login')
    ) {
      return new AuthenticationError(error.message, {
        originalError: error.message,
      });
    }

    // Validation errors
    if (
      error.message.includes('validation') ||
      error.message.includes('invalid') ||
      error.message.includes('required')
    ) {
      return new ValidationError(error.message, {
        originalError: error.message,
      });
    }

    // Upload errors
    if (
      error.message.includes('upload') ||
      error.message.includes('file') ||
      error.message.includes('size')
    ) {
      return new UploadError(error.message, { originalError: error.message });
    }

    // Payment errors
    if (
      error.message.includes('payment') ||
      error.message.includes('mercadopago') ||
      error.message.includes('transaction')
    ) {
      return new PaymentError(error.message, { originalError: error.message });
    }

    // Generic error
    return new AppError(
      error.message,
      ErrorType.UNKNOWN,
      ErrorSeverity.MEDIUM,
      {
        originalError: error.message,
      }
    );
  }

  // Unknown error type
  let errorString: string;
  try {
    errorString = String(error);
  } catch {
    errorString = 'Unable to convert error to string';
  }

  return new AppError(
    'An unknown error occurred',
    ErrorType.UNKNOWN,
    ErrorSeverity.MEDIUM,
    { originalError: errorString }
  );
}

// Error recovery strategies
export interface RecoveryStrategy {
  canRecover: (error: AppError) => boolean;
  recover: (error: AppError) => Promise<void> | void;
  description: string;
}

// Built-in recovery strategies
export const recoveryStrategies: RecoveryStrategy[] = [
  {
    canRecover: (error) => error.type === ErrorType.NETWORK && error.retryable,
    recover: async () => {
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    description: 'Retry network request after delay',
  },
  {
    canRecover: (error) => error.type === ErrorType.AUTHENTICATION,
    recover: () => {
      // Redirect to login
      window.location.href = '/login';
    },
    description: 'Redirect to login page',
  },
  {
    canRecover: (error) => error.type === ErrorType.UPLOAD,
    recover: () => {
      // Clear upload state
      localStorage.removeItem('upload-progress');
    },
    description: 'Clear upload state and allow retry',
  },
];

// Error recovery manager
export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [...recoveryStrategies];

  addStrategy(strategy: RecoveryStrategy) {
    this.strategies.push(strategy);
  }

  async attemptRecovery(error: AppError): Promise<boolean> {
    const applicableStrategies = this.strategies.filter((strategy) =>
      strategy.canRecover(error)
    );

    for (const strategy of applicableStrategies) {
      try {
        await strategy.recover(error);
        return true;
      } catch (recoveryError) {
        console.warn(
          'Recovery strategy failed:',
          strategy.description,
          recoveryError
        );
      }
    }

    return false;
  }

  getRecoveryOptions(error: AppError): RecoveryStrategy[] {
    return this.strategies.filter((strategy) => strategy.canRecover(error));
  }
}

// Global error recovery manager instance
export const errorRecoveryManager = new ErrorRecoveryManager();

// Error logging utility
export function logError(error: AppError, context?: string) {
  const logEntry = {
    errorId: error.errorId,
    type: error.type,
    severity: error.severity,
    message: error.message,
    context: context || 'Unknown',
    timestamp: error.timestamp.toISOString(),
    stack: error.stack,
    additionalContext: error.context,
    url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown',
  };

  // Console logging based on severity
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('CRITICAL ERROR:', logEntry);
      break;
    case ErrorSeverity.HIGH:
      console.error('HIGH SEVERITY ERROR:', logEntry);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('MEDIUM SEVERITY ERROR:', logEntry);
      break;
    case ErrorSeverity.LOW:
      console.info('LOW SEVERITY ERROR:', logEntry);
      break;
  }

  // Store in localStorage for debugging
  try {
    const existingLogs = JSON.parse(
      localStorage.getItem('docfiscal-error-logs') || '[]'
    );
    existingLogs.push(logEntry);

    // Keep only last 50 logs
    if (existingLogs.length > 50) {
      existingLogs.splice(0, existingLogs.length - 50);
    }

    localStorage.setItem('docfiscal-error-logs', JSON.stringify(existingLogs));
  } catch (storageError) {
    console.warn('Failed to store error log:', storageError);
  }
}

// User-friendly error messages
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Connection problem. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Please log in to continue.';
    case ErrorType.AUTHORIZATION:
      return "You don't have permission to perform this action.";
    case ErrorType.VALIDATION:
      return 'Please check your input and try again.';
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    case ErrorType.UPLOAD:
      return 'File upload failed. Please check your file and try again.';
    case ErrorType.PAYMENT:
      return 'Payment processing failed. Please try again or contact support.';
    case ErrorType.SERVER:
      return 'Server error. Please try again later.';
    case ErrorType.CLIENT:
      return 'Something went wrong. Please refresh the page and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// Error boundary error handler
export function handleErrorBoundaryError(
  error: Error,
  errorInfo: React.ErrorInfo
) {
  const appError = classifyError(error);
  const errorWithContext = {
    ...appError,
    context: {
      ...appError.context,
      componentStack: errorInfo.componentStack,
    },
  };

  logError(errorWithContext, 'React Error Boundary');

  // Attempt recovery
  errorRecoveryManager.attemptRecovery(errorWithContext);
}

// Async error handler for promises
export function handleAsyncError(error: unknown, context?: string): AppError {
  const appError = classifyError(error);
  logError(appError, context);
  return appError;
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw handleAsyncError(lastError, 'Retry exhausted');
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Circuit breaker pattern for API calls
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new NetworkError('Circuit breaker is OPEN', {
          failures: this.failures,
          lastFailureTime: this.lastFailureTime,
        });
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
