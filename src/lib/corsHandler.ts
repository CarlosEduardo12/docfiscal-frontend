/**
 * CORS Error Handler and Diagnostic Utility
 * Provides CORS error detection, diagnosis, and resolution guidance
 * Enhanced with production-specific configurations and fallbacks
 */

import { environmentConfig } from './environmentConfig';

export interface CorsConfig {
  apiUrl: string;
  frontendUrl: string;
  environment: 'development' | 'production' | 'test';
}

export interface CorsDiagnostic {
  hasCorsIssue: boolean;
  issues: string[];
  recommendations: string[];
  canRetry: boolean;
}

export interface CorsProductionConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
  preflightFallback: boolean;
}

export class CorsHandler {
  /**
   * Get production-specific CORS configuration
   */
  static getProductionCorsConfig(): CorsProductionConfig {
    const envConfig = environmentConfig.getConfig();

    // Define allowed origins based on environment
    const allowedOrigins = [];

    if (envConfig.isProduction) {
      // Production origins
      if (envConfig.frontendUrl) {
        allowedOrigins.push(envConfig.frontendUrl);

        try {
          // Add common production domain variations
          const frontendDomain = new URL(envConfig.frontendUrl);
          allowedOrigins.push(`https://${frontendDomain.hostname}`);
          allowedOrigins.push(`https://www.${frontendDomain.hostname}`);
        } catch (error) {
          console.warn(
            '⚠️ Invalid frontend URL for CORS configuration:',
            envConfig.frontendUrl
          );
        }
      }

      // Add any additional production domains from environment
      const additionalOrigins = process.env.NEXT_PUBLIC_ADDITIONAL_ORIGINS;
      if (additionalOrigins) {
        allowedOrigins.push(
          ...additionalOrigins.split(',').map((o) => o.trim())
        );
      }
    } else {
      // Development origins
      allowedOrigins.push('http://localhost:3000');
      allowedOrigins.push('http://localhost:3001');
      allowedOrigins.push('http://127.0.0.1:3000');
      if (envConfig.frontendUrl) {
        allowedOrigins.push(envConfig.frontendUrl);
      }
    }

    return {
      allowedOrigins: Array.from(new Set(allowedOrigins)), // Remove duplicates
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name',
      ],
      allowCredentials: true,
      maxAge: envConfig.isProduction ? 86400 : 3600, // 24h prod, 1h dev
      preflightFallback: envConfig.isProduction,
    };
  }

  /**
   * Validate CORS configuration for production
   */
  static validateProductionCors(config: CorsConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.environment === 'production') {
      // Check if URLs are provided
      if (!config.apiUrl || !config.frontendUrl) {
        errors.push('API URL and Frontend URL must be provided in production');
        return { isValid: false, errors, warnings };
      }

      try {
        const apiUrl = new URL(config.apiUrl);
        const frontendUrl = new URL(config.frontendUrl);

        // Check for HTTPS in production
        if (apiUrl.protocol !== 'https:') {
          errors.push('API must use HTTPS in production');
        }

        if (frontendUrl.protocol !== 'https:') {
          errors.push('Frontend must use HTTPS in production');
        }

        // Check for localhost in production
        if (
          apiUrl.hostname === 'localhost' ||
          apiUrl.hostname === '127.0.0.1'
        ) {
          errors.push('API cannot use localhost in production');
        }

        if (
          frontendUrl.hostname === 'localhost' ||
          frontendUrl.hostname === '127.0.0.1'
        ) {
          errors.push('Frontend cannot use localhost in production');
        }

        // Check for proper domain configuration
        if (
          apiUrl.hostname.includes('railway.app') &&
          !frontendUrl.hostname.includes('.')
        ) {
          warnings.push('Using Railway API with non-domain frontend URL');
        }

        // Check for wildcard origins (security risk)
        const corsConfig = this.getProductionCorsConfig();
        if (corsConfig.allowedOrigins.includes('*')) {
          errors.push('Wildcard origins (*) are not allowed in production');
        }
      } catch (error) {
        errors.push(`Invalid URL format: ${error}`);
        return { isValid: false, errors, warnings };
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
  /**
   * Detect CORS issues from various error indicators
   * Enhanced with production-specific detection
   */
  static detectCorsIssue(error: any, response?: Response): boolean {
    // Direct CORS error messages
    if (
      error.message &&
      (error.message.includes('CORS') ||
        error.message.includes('Cross-Origin') ||
        error.message.includes('Access-Control-Allow-Origin') ||
        error.message.includes('has been blocked by CORS policy') ||
        error.message.includes('preflight') ||
        error.message.includes('Origin is not allowed'))
    ) {
      return true;
    }

    // Network errors that might be CORS-related
    if (
      error.name === 'TypeError' &&
      (error.message.includes('Failed to fetch') ||
        error.message.includes('Network request failed') ||
        error.message.includes('Load failed'))
    ) {
      return true; // Could be CORS or network
    }

    // Response indicators
    if (response) {
      // Status 0 often indicates CORS issues
      if (response.status === 0) {
        return true;
      }

      // Opaque responses
      if (response.type === 'opaque') {
        return true;
      }

      // Missing CORS headers in production
      const envConfig = environmentConfig.getConfig();
      if (envConfig.isProduction && response.status === 200) {
        const corsHeader = response.headers.get('access-control-allow-origin');
        if (!corsHeader) {
          return true; // Likely CORS misconfiguration
        }
      }
    }

    return false;
  }

  /**
   * Diagnose CORS configuration issues
   * Enhanced with production-specific validation
   */
  static diagnoseCorsIssues(config: CorsConfig): CorsDiagnostic {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate production configuration
    const validation = this.validateProductionCors(config);
    issues.push(...validation.errors);
    recommendations.push(...validation.warnings.map((w) => `Warning: ${w}`));

    // Check URL protocols
    const apiUrl = new URL(config.apiUrl);
    const frontendUrl = new URL(config.frontendUrl);

    if (apiUrl.protocol !== frontendUrl.protocol) {
      issues.push('Protocol mismatch between frontend and API');
      recommendations.push(
        'Ensure both frontend and API use the same protocol (HTTP or HTTPS)'
      );
    }

    // Check for localhost vs production domains
    if (config.environment === 'production') {
      if (apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
        issues.push('API URL uses localhost in production');
        recommendations.push(
          'Use production domain for API URL instead of localhost'
        );
      }

      if (
        frontendUrl.hostname === 'localhost' ||
        frontendUrl.hostname === '127.0.0.1'
      ) {
        issues.push('Frontend URL uses localhost in production');
        recommendations.push(
          'Use production domain for frontend URL instead of localhost'
        );
      }

      // Check for proper SSL configuration
      if (apiUrl.protocol === 'http:') {
        issues.push('API should use HTTPS in production');
        recommendations.push('Configure SSL certificate for API domain');
      }

      if (frontendUrl.protocol === 'http:') {
        issues.push('Frontend should use HTTPS in production');
        recommendations.push('Configure SSL certificate for frontend domain');
      }
    }

    // Check for common port issues
    if (config.environment === 'development') {
      if (apiUrl.port && frontendUrl.port && apiUrl.port === frontendUrl.port) {
        issues.push('API and frontend using same port');
        recommendations.push(
          'Use different ports for API and frontend in development'
        );
      }
    }

    // Check for subdomain issues
    if (apiUrl.hostname !== frontendUrl.hostname) {
      const apiDomain = apiUrl.hostname.split('.').slice(-2).join('.');
      const frontendDomain = frontendUrl.hostname
        .split('.')
        .slice(-2)
        .join('.');

      if (apiDomain !== frontendDomain && config.environment === 'production') {
        issues.push('API and frontend on different domains');
        recommendations.push(
          'Ensure CORS is properly configured for cross-domain requests'
        );
      }
    }

    return {
      hasCorsIssue: issues.length > 0,
      issues,
      recommendations,
      canRetry: config.environment === 'development', // Only retry in development
    };
  }

  /**
   * Attempt CORS fallback request with different configurations
   */
  static async attemptCorsFallback(
    url: string,
    options: RequestInit = {}
  ): Promise<{
    success: boolean;
    response?: Response;
    method?: string;
    error?: string;
  }> {
    const envConfig = environmentConfig.getConfig();
    const corsConfig = this.getProductionCorsConfig();

    // Only attempt fallbacks in production with preflight enabled
    if (!envConfig.isProduction || !corsConfig.preflightFallback) {
      return {
        success: false,
        error: 'Fallback not enabled for this environment',
      };
    }

    const fallbackMethods = [
      // Try with explicit CORS mode
      {
        mode: 'cors' as RequestMode,
        credentials: 'include' as RequestCredentials,
      },
      {
        mode: 'cors' as RequestMode,
        credentials: 'same-origin' as RequestCredentials,
      },
      {
        mode: 'cors' as RequestMode,
        credentials: 'omit' as RequestCredentials,
      },

      // Try without credentials
      { mode: 'cors' as RequestMode },

      // Try with no-cors mode (limited functionality)
      { mode: 'no-cors' as RequestMode },
    ];

    for (let index = 0; index < fallbackMethods.length; index++) {
      const fallbackConfig = fallbackMethods[index];
      try {
        console.log(
          `🔄 Attempting CORS fallback method ${index + 1}:`,
          fallbackConfig
        );

        const response = await fetch(url, {
          ...options,
          ...fallbackConfig,
          headers: {
            ...options.headers,
            'X-Requested-With': 'XMLHttpRequest', // Help identify AJAX requests
          },
        });

        if (response.ok || response.status < 400) {
          console.log(`✅ CORS fallback method ${index + 1} succeeded`);
          return {
            success: true,
            response,
            method: `fallback_${index + 1}`,
          };
        }
      } catch (error) {
        console.log(`❌ CORS fallback method ${index + 1} failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'All CORS fallback methods failed',
    };
  }

  /**
   * Get production-specific CORS guidance
   */
  static getProductionCorsGuidance(config: CorsConfig): string[] {
    const guidance: string[] = [];
    const validation = this.validateProductionCors(config);

    if (config.environment === 'production') {
      guidance.push('=== Production CORS Configuration ===');

      if (validation.errors.length > 0) {
        guidance.push('CRITICAL ERRORS:');
        validation.errors.forEach((error) => guidance.push(`- ${error}`));
        guidance.push('');
      }

      if (validation.warnings.length > 0) {
        guidance.push('WARNINGS:');
        validation.warnings.forEach((warning) => guidance.push(`- ${warning}`));
        guidance.push('');
      }

      const corsConfig = this.getProductionCorsConfig();
      guidance.push('Required Server Configuration:');
      guidance.push(
        `- Access-Control-Allow-Origin: ${corsConfig.allowedOrigins.join(', ')}`
      );
      guidance.push(
        `- Access-Control-Allow-Methods: ${corsConfig.allowedMethods.join(', ')}`
      );
      guidance.push(
        `- Access-Control-Allow-Headers: ${corsConfig.allowedHeaders.join(', ')}`
      );
      guidance.push(
        `- Access-Control-Allow-Credentials: ${corsConfig.allowCredentials}`
      );
      guidance.push(`- Access-Control-Max-Age: ${corsConfig.maxAge}`);
      guidance.push('');
    }

    guidance.push('General CORS Troubleshooting:');
    guidance.push('1. Verify API server CORS configuration');
    guidance.push('2. Check that frontend domain is in allowed origins');
    guidance.push('3. Ensure preflight requests are handled correctly');
    guidance.push('4. Verify SSL certificates are valid');
    guidance.push('5. Check for proxy or CDN CORS settings');

    return guidance;
  }
  /**
   * Get user-friendly CORS error message
   * Enhanced with production-specific messaging
   */
  static getCorsErrorMessage(config: CorsConfig): string {
    const diagnostic = this.diagnoseCorsIssues(config);

    if (diagnostic.hasCorsIssue) {
      if (config.environment === 'production') {
        return `Erro de configuração CORS em produção detectado. ${diagnostic.issues.join('. ')}. Entre em contato com o administrador do sistema.`;
      } else {
        return `Erro de configuração CORS detectado. ${diagnostic.issues.join('. ')}.`;
      }
    }

    if (config.environment === 'production') {
      return 'Erro de CORS em produção. O servidor não está configurado para aceitar requisições desta origem. Entre em contato com o suporte técnico.';
    }

    return 'Erro de CORS. O servidor não está configurado para aceitar requisições desta origem.';
  }

  /**
   * Get CORS resolution guidance
   * Enhanced with production-specific guidance
   */
  static getCorsGuidance(config: CorsConfig): string[] {
    const diagnostic = this.diagnoseCorsIssues(config);

    if (config.environment === 'production') {
      return this.getProductionCorsGuidance(config);
    }

    const baseGuidance = [
      'Entre em contato com o administrador do sistema',
      'Verifique se o servidor está configurado corretamente',
      'Confirme se as URLs de frontend e API estão corretas',
    ];

    return [...diagnostic.recommendations, ...baseGuidance];
  }

  /**
   * Test CORS configuration with a simple request
   * Enhanced with production-specific testing
   */
  static async testCorsConfiguration(apiUrl: string): Promise<{
    success: boolean;
    error?: string;
    corsHeaders?: Record<string, string>;
    fallbackAttempted?: boolean;
    fallbackSuccess?: boolean;
  }> {
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const corsHeaders: Record<string, string> = {};

      // Collect CORS-related headers
      const corsHeaderNames = [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers',
        'access-control-allow-credentials',
        'access-control-max-age',
        'access-control-expose-headers',
      ];

      corsHeaderNames.forEach((headerName) => {
        const value = response.headers.get(headerName);
        if (value) {
          corsHeaders[headerName] = value;
        }
      });

      if (response.ok) {
        return {
          success: true,
          corsHeaders,
        };
      } else {
        // Try fallback methods if initial request fails
        const fallbackResult = await this.attemptCorsFallback(
          `${apiUrl}/health`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        return {
          success: fallbackResult.success,
          error: fallbackResult.error,
          corsHeaders,
          fallbackAttempted: true,
          fallbackSuccess: fallbackResult.success,
        };
      }
    } catch (error) {
      // Try fallback methods if initial request throws
      const fallbackResult = await this.attemptCorsFallback(
        `${apiUrl}/health`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      return {
        success: fallbackResult.success,
        error: fallbackResult.success
          ? undefined
          : error instanceof Error
            ? error.message
            : 'Unknown error',
        fallbackAttempted: true,
        fallbackSuccess: fallbackResult.success,
      };
    }
  }

  /**
   * Generate CORS troubleshooting report
   * Enhanced with production-specific information
   */
  static generateTroubleshootingReport(
    config: CorsConfig,
    error?: any
  ): string {
    const diagnostic = this.diagnoseCorsIssues(config);
    const envConfig = environmentConfig.getConfig();

    let report = '=== CORS Troubleshooting Report ===\n\n';

    report += `Environment: ${config.environment}\n`;
    report += `API URL: ${config.apiUrl}\n`;
    report += `Frontend URL: ${config.frontendUrl}\n`;
    report += `HTTPS Enabled: ${envConfig.isHttps}\n`;
    report += `Secure Context: ${typeof window !== 'undefined' ? window.isSecureContext : 'N/A'}\n\n`;

    if (error) {
      report += `Error Message: ${error.message || 'Unknown error'}\n`;
      report += `Error Type: ${error.name || 'Unknown'}\n\n`;
    }

    if (diagnostic.hasCorsIssue) {
      report += 'Detected Issues:\n';
      diagnostic.issues.forEach((issue, index) => {
        report += `${index + 1}. ${issue}\n`;
      });
      report += '\n';

      report += 'Recommendations:\n';
      diagnostic.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += '\n';
    }

    // Add production-specific configuration
    if (config.environment === 'production') {
      const corsConfig = this.getProductionCorsConfig();
      report += 'Required Production CORS Configuration:\n';
      report += `Access-Control-Allow-Origin: ${corsConfig.allowedOrigins.join(', ')}\n`;
      report += `Access-Control-Allow-Methods: ${corsConfig.allowedMethods.join(', ')}\n`;
      report += `Access-Control-Allow-Headers: ${corsConfig.allowedHeaders.join(', ')}\n`;
      report += `Access-Control-Allow-Credentials: ${corsConfig.allowCredentials}\n`;
      report += `Access-Control-Max-Age: ${corsConfig.maxAge}\n\n`;
    }

    report += 'Common Solutions:\n';
    report += '1. Ensure the API server includes proper CORS headers\n';
    report += '2. Check that the API allows the frontend domain\n';
    report += '3. Verify that the API allows the required HTTP methods\n';
    report += '4. Confirm that credentials are handled correctly if needed\n';
    report += '5. Check for protocol mismatches (HTTP vs HTTPS)\n';

    if (config.environment === 'production') {
      report += '6. Verify SSL certificates are valid and trusted\n';
      report += '7. Check proxy or CDN CORS configuration\n';
      report += '8. Ensure preflight OPTIONS requests are handled\n';
      report += '9. Verify domain DNS configuration\n';
    }

    return report;
  }

  /**
   * Log CORS error with detailed information
   */
  static logCorsError(config: CorsConfig, error: any): void {
    console.group('🚫 CORS Error Detected');
    console.error('Error:', error);
    console.log('Configuration:', config);

    const diagnostic = this.diagnoseCorsIssues(config);
    if (diagnostic.hasCorsIssue) {
      console.log('Issues:', diagnostic.issues);
      console.log('Recommendations:', diagnostic.recommendations);
    }

    console.log('Troubleshooting Report:');
    console.log(this.generateTroubleshootingReport(config, error));
    console.groupEnd();
  }
}
