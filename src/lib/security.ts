/**
 * Security utilities for HTTPS enforcement and secure communication
 */

// HTTPS enforcement configuration
const getSecurityConfig = () => ({
  enforceHttps: process.env.NODE_ENV === 'production',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [],
  requireSecureHeaders: process.env.NODE_ENV === 'production',
});

export const SECURITY_CONFIG = getSecurityConfig();

/**
 * Enforces HTTPS for URLs in production environment
 * @param url - The URL to check and potentially upgrade
 * @returns The URL with HTTPS protocol if needed
 */
export function enforceHttpsUrl(url: string): string {
  // Skip enforcement in development and test environments
  const currentConfig = getSecurityConfig();
  if (!currentConfig.enforceHttps) {
    return url;
  }

  // Skip localhost and local IPs
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('0.0.0.0')
  ) {
    return url;
  }

  // Upgrade HTTP to HTTPS
  if (url.startsWith('http://')) {
    console.warn('Security: Upgrading HTTP to HTTPS:', url);
    return url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Validates that a URL uses HTTPS protocol in production
 * @param url - The URL to validate
 * @throws Error if URL is not secure in production
 */
export function validateSecureUrl(url: string): void {
  const currentConfig = getSecurityConfig();
  if (!currentConfig.enforceHttps) {
    return;
  }

  // Allow relative URLs and localhost
  if (
    url.startsWith('/') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  ) {
    return;
  }

  if (!url.startsWith('https://')) {
    throw new Error(`Insecure URL not allowed in production: ${url}`);
  }
}

/**
 * Creates secure request headers for API calls
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with security headers
 */
export function createSecureHeaders(
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  const currentConfig = getSecurityConfig();
  const baseHeaders: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    'Cache-Control': 'no-cache',
  };

  if (currentConfig.requireSecureHeaders) {
    baseHeaders['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains';
    baseHeaders['X-Content-Type-Options'] = 'nosniff';
    baseHeaders['X-Frame-Options'] = 'DENY';
  }

  return {
    ...baseHeaders,
    ...additionalHeaders,
  };
}

/**
 * Creates secure fetch options for API requests
 * @param options - Base fetch options
 * @returns Fetch options with security configurations
 */
export function createSecureFetchOptions(
  options: RequestInit = {}
): RequestInit {
  const currentConfig = getSecurityConfig();
  const secureOptions: RequestInit = {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...createSecureHeaders(),
      ...options.headers,
    },
  };

  if (currentConfig.enforceHttps) {
    secureOptions.mode = 'cors';
    secureOptions.referrerPolicy = 'strict-origin-when-cross-origin';
  }

  return secureOptions;
}

/**
 * Validates origin for CORS requests
 * @param origin - The origin to validate
 * @returns True if origin is allowed
 */
export function isAllowedOrigin(origin: string): boolean {
  const currentConfig = getSecurityConfig();
  if (!currentConfig.enforceHttps) {
    return true; // Allow all origins in development
  }

  if (currentConfig.allowedOrigins.length === 0) {
    return true; // No restrictions if no origins configured
  }

  return currentConfig.allowedOrigins.includes(origin);
}

/**
 * Security audit function to check current configuration
 * @returns Security audit results
 */
export function auditSecurity(): {
  httpsEnforced: boolean;
  secureHeadersEnabled: boolean;
  corsConfigured: boolean;
  issues: string[];
} {
  const currentConfig = getSecurityConfig();
  const issues: string[] = [];

  if (process.env.NODE_ENV === 'production') {
    if (!currentConfig.enforceHttps) {
      issues.push('HTTPS enforcement is disabled in production');
    }

    if (!process.env.NEXTAUTH_SECRET) {
      issues.push('NEXTAUTH_SECRET is not configured');
    }

    if (!process.env.NEXTAUTH_URL?.startsWith('https://')) {
      issues.push('NEXTAUTH_URL should use HTTPS in production');
    }
  }

  return {
    httpsEnforced: currentConfig.enforceHttps,
    secureHeadersEnabled: currentConfig.requireSecureHeaders,
    corsConfigured: currentConfig.allowedOrigins.length > 0,
    issues,
  };
}

/**
 * Logs security warnings and issues
 */
export function logSecurityAudit(): void {
  const audit = auditSecurity();

  if (audit.issues.length > 0) {
    console.warn('Security audit found issues:', audit.issues);
  } else {
    console.log('Security audit passed');
  }
}

// Run security audit on module load in production
if (process.env.NODE_ENV === 'production') {
  logSecurityAudit();
}
