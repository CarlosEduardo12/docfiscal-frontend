/**
 * Comprehensive Error Handler for Authentication System
 * Provides network error detection, specific error messages, and recovery guidance
 */

import { authLogger } from './authLogger';

export interface NetworkError {
  type: 'network';
  code: string;
  message: string;
  userMessage: string;
  guidance?: string;
  retryable: boolean;
  retryAfter?: number;
}

export interface AuthError {
  type: 'auth';
  code: string;
  message: string;
  userMessage: string;
  guidance?: string;
  shouldClearTokens: boolean;
  shouldRedirect: boolean;
}

export interface CorsError {
  type: 'cors';
  code: string;
  message: string;
  userMessage: string;
  guidance: string;
  retryable: boolean;
}

export type AppError = NetworkError | AuthError | CorsError;

export class ErrorHandler {
  /**
   * Detect and classify network errors
   */
  static detectNetworkError(error: any): NetworkError | null {
    // Handle null/undefined errors
    if (!error) {
      return null;
    }

    // Check for fetch/network errors
    if (error instanceof TypeError) {
      if (error.message && error.message.includes('fetch')) {
        return {
          type: 'network',
          code: 'FETCH_FAILED',
          message: error.message,
          userMessage:
            'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
          guidance:
            'Verifique se você está conectado à internet e tente novamente.',
          retryable: true,
        };
      }

      if (
        error.message &&
        (error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch'))
      ) {
        return {
          type: 'network',
          code: 'NETWORK_ERROR',
          message: error.message,
          userMessage: 'Erro de rede. Verifique sua conexão.',
          guidance:
            'Verifique sua conexão com a internet e tente novamente em alguns segundos.',
          retryable: true,
        };
      }
    }

    // Check for timeout errors
    if (
      error.name === 'AbortError' ||
      (error.message && error.message.includes('timeout'))
    ) {
      return {
        type: 'network',
        code: 'TIMEOUT',
        message: error.message || 'Request timeout',
        userMessage: 'A conexão demorou muito para responder.',
        guidance:
          'O servidor pode estar sobrecarregado. Tente novamente em alguns minutos.',
        retryable: true,
        retryAfter: 30000, // 30 seconds
      };
    }

    // Check for DNS/connection errors
    if (
      error.message &&
      (error.message.includes('getaddrinfo') ||
        error.message.includes('ENOTFOUND'))
    ) {
      return {
        type: 'network',
        code: 'DNS_ERROR',
        message: error.message,
        userMessage: 'Não foi possível encontrar o servidor.',
        guidance:
          'Verifique sua conexão com a internet ou tente novamente mais tarde.',
        retryable: true,
      };
    }

    // Check for connection refused
    if (
      error.message &&
      (error.message.includes('ECONNREFUSED') ||
        error.message.includes('Connection refused'))
    ) {
      return {
        type: 'network',
        code: 'CONNECTION_REFUSED',
        message: error.message,
        userMessage: 'O servidor não está disponível no momento.',
        guidance:
          'O servidor pode estar em manutenção. Tente novamente em alguns minutos.',
        retryable: true,
        retryAfter: 60000, // 1 minute
      };
    }

    return null;
  }

  /**
   * Detect and classify CORS errors
   */
  static detectCorsError(error: any, response?: Response): CorsError | null {
    // Check for CORS-related errors
    if (
      error &&
      error.message &&
      (error.message.includes('CORS') ||
        error.message.includes('Cross-Origin') ||
        error.message.includes('Access-Control-Allow-Origin'))
    ) {
      return {
        type: 'cors',
        code: 'CORS_ERROR',
        message: error.message,
        userMessage: 'Erro de CORS - configuração de segurança.',
        guidance:
          'Este é um problema de configuração do servidor. Entre em contato com o suporte técnico.',
        retryable: false,
      };
    }

    // Check for opaque responses that might indicate CORS issues
    if (response && response.type === 'opaque') {
      return {
        type: 'cors',
        code: 'OPAQUE_RESPONSE',
        message: 'Received opaque response, likely CORS issue',
        userMessage: 'Erro de CORS - configuração de segurança.',
        guidance:
          'Problema de configuração do servidor. Entre em contato com o suporte.',
        retryable: false,
      };
    }

    // Check for specific status codes that might indicate CORS
    if (response && response.status === 0) {
      return {
        type: 'cors',
        code: 'STATUS_ZERO',
        message: 'Response status 0, likely CORS or network issue',
        userMessage: 'Erro de CORS ou conexão.',
        guidance:
          'Pode ser um problema de rede ou configuração do servidor. Tente novamente ou entre em contato com o suporte.',
        retryable: true,
      };
    }

    return null;
  }

  /**
   * Detect and classify authentication errors
   */
  static detectAuthError(error: any, response?: Response): AuthError | null {
    // Check for 401 Unauthorized
    if (response && response.status === 401) {
      return {
        type: 'auth',
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        userMessage: 'Credenciais inválidas ou sessão expirada.',
        guidance: 'Faça login novamente com suas credenciais.',
        shouldClearTokens: true,
        shouldRedirect: true,
      };
    }

    // Check for 403 Forbidden
    if (response && response.status === 403) {
      return {
        type: 'auth',
        code: 'FORBIDDEN',
        message: 'Access forbidden',
        userMessage: 'Você não tem permissão para acessar este recurso.',
        guidance:
          'Entre em contato com o administrador se você acredita que deveria ter acesso.',
        shouldClearTokens: false,
        shouldRedirect: false,
      };
    }

    // Check for token-related errors
    if (
      error &&
      error.message &&
      error.message.includes('token') &&
      error.message.includes('invalid')
    ) {
      return {
        type: 'auth',
        code: 'INVALID_TOKEN',
        message: error.message,
        userMessage: 'Token de autenticação inválido.',
        guidance: 'Sua sessão expirou. Faça login novamente.',
        shouldClearTokens: true,
        shouldRedirect: true,
      };
    }

    // Check for refresh token errors
    if (
      error &&
      error.message &&
      error.message.includes('refresh') &&
      error.message.includes('failed')
    ) {
      return {
        type: 'auth',
        code: 'REFRESH_FAILED',
        message: error.message,
        userMessage: 'Não foi possível renovar sua sessão.',
        guidance: 'Faça login novamente para continuar.',
        shouldClearTokens: true,
        shouldRedirect: true,
      };
    }

    return null;
  }

  /**
   * Comprehensive error classification
   */
  static classifyError(error: any, response?: Response): AppError {
    // Handle null/undefined errors
    if (!error) {
      return {
        type: 'network',
        code: 'UNKNOWN_ERROR',
        message: 'No error information provided',
        userMessage: 'Ocorreu um erro inesperado.',
        guidance:
          'Tente novamente. Se o problema persistir, entre em contato com o suporte.',
        retryable: true,
      };
    }

    // Try to detect specific error types
    const networkError = this.detectNetworkError(error);
    if (networkError) return networkError;

    const corsError = this.detectCorsError(error, response);
    if (corsError) return corsError;

    const authError = this.detectAuthError(error, response);
    if (authError) return authError;

    // Default to generic network error
    return {
      type: 'network',
      code: 'UNKNOWN_ERROR',
      message:
        error.message ||
        (typeof error.toString === 'function'
          ? error.toString()
          : 'Unknown error occurred'),
      userMessage: 'Ocorreu um erro inesperado.',
      guidance:
        'Tente novamente. Se o problema persistir, entre em contato com o suporte.',
      retryable: true,
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: AppError): boolean {
    return 'retryable' in error ? error.retryable : false;
  }

  /**
   * Get retry delay for retryable errors
   */
  static getRetryDelay(error: AppError): number {
    if ('retryAfter' in error && error.retryAfter) {
      return error.retryAfter;
    }

    // Default retry delays based on error type
    switch (error.code) {
      case 'TIMEOUT':
        return 30000; // 30 seconds
      case 'CONNECTION_REFUSED':
        return 60000; // 1 minute
      case 'DNS_ERROR':
        return 10000; // 10 seconds
      default:
        return 5000; // 5 seconds
    }
  }

  /**
   * Log error with appropriate level and context
   */
  static logError(error: AppError, context?: string): void {
    const logContext = context ? `[${context}]` : '';

    // Log to console with appropriate level
    switch (error.type) {
      case 'network':
        console.error(`🌐 ${logContext} Network Error [${error.code}]:`, {
          message: error.message,
          userMessage: error.userMessage,
          guidance: error.guidance,
          retryable: error.retryable,
        });
        break;

      case 'cors':
        console.error(`🚫 ${logContext} CORS Error [${error.code}]:`, {
          message: error.message,
          userMessage: error.userMessage,
          guidance: error.guidance,
        });
        break;

      case 'auth':
        console.error(`🔐 ${logContext} Auth Error [${error.code}]:`, {
          message: error.message,
          userMessage: error.userMessage,
          shouldClearTokens: error.shouldClearTokens,
          shouldRedirect: error.shouldRedirect,
        });
        break;
    }

    // Log to authentication logger with detailed information
    authLogger.logAuthError({
      errorType: this.mapErrorTypeToAuthLogger(error.type),
      errorCode: error.code,
      errorMessage: error.message,
      operation: context || 'unknown',
      context: {
        userMessage: error.userMessage,
        guidance: error.guidance,
        retryable: this.isRetryable(error),
        shouldClearTokens: this.shouldClearTokens(error),
        shouldRedirect: this.shouldRedirect(error),
        retryAfter: 'retryAfter' in error ? error.retryAfter : undefined,
      },
      httpStatus: this.extractHttpStatus(error),
      retryable: this.isRetryable(error),
    });
  }

  /**
   * Map error type to auth logger error type
   */
  private static mapErrorTypeToAuthLogger(
    errorType: string
  ):
    | 'network'
    | 'validation'
    | 'authentication'
    | 'authorization'
    | 'cors'
    | 'server'
    | 'client'
    | 'unknown' {
    switch (errorType) {
      case 'network':
        return 'network';
      case 'cors':
        return 'cors';
      case 'auth':
        return 'authentication';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract HTTP status from error if available
   */
  private static extractHttpStatus(error: AppError): number | undefined {
    if (error.code.startsWith('HTTP_')) {
      const statusMatch = error.code.match(/HTTP_(\d+)/);
      return statusMatch ? parseInt(statusMatch[1], 10) : undefined;
    }
    return undefined;
  }

  /**
   * Create user-friendly error message for display
   */
  static getUserMessage(error: AppError): string {
    return error.userMessage;
  }

  /**
   * Get guidance message for error resolution
   */
  static getGuidance(error: AppError): string | undefined {
    return error.guidance;
  }

  /**
   * Check if error requires token cleanup
   */
  static shouldClearTokens(error: AppError): boolean {
    return error.type === 'auth' && (error as AuthError).shouldClearTokens;
  }

  /**
   * Check if error requires redirect
   */
  static shouldRedirect(error: AppError): boolean {
    return error.type === 'auth' && (error as AuthError).shouldRedirect;
  }
}
