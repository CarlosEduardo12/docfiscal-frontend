import { authTokenManager } from './AuthTokenManager';
import { ErrorHandler, AppError } from './errorHandler';
import { CorsHandler } from './corsHandler';
import { environmentConfig } from './environmentConfig';
import { secureStorage } from './secureStorage';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: {
    field_errors?: Record<string, string[]>;
    retry_after?: number;
    guidance?: string;
  };
  request_id?: string;
}

interface EnhancedApiResponse<T = any> extends ApiResponse<T> {
  appError?: AppError;
}

class ApiClient {
  private baseURL: string;
  private corsConfig: { apiUrl: string; frontendUrl: string; environment: 'development' | 'production' | 'test' };

  constructor() {
    // Use environment configuration for all URLs and settings
    const envConfig = environmentConfig.getConfig();
    this.baseURL = envConfig.apiUrl;
    this.corsConfig = {
      apiUrl: envConfig.apiUrl,
      frontendUrl: envConfig.frontendUrl,
      environment: envConfig.environment,
    };
    
    // Log configuration in development
    if (envConfig.isDevelopment) {
      console.log('🔧 API Client initialized with:', {
        baseURL: this.baseURL,
        environment: envConfig.environment,
        isHttps: envConfig.isHttps,
        corsEnabled: envConfig.corsEnabled,
      });
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<EnhancedApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // Get security headers for HTTPS environments
    const securityHeaders = secureStorage.getSecurityHeaders();
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders, // Add security headers
        ...options.headers,
      },
      ...options,
    };

    // Add auth header if token exists and not explicitly skipped
    if (!options.skipAuth) {
      const accessToken = await authTokenManager.getValidToken();
      if (accessToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        };
      }
    }

    let response: Response | undefined;

    try {
      console.log('🔄 Making request to:', url);
      console.log('📦 Request config:', config);

      response = await fetch(url, config);
      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        // Try to parse error response
        let errorData: ApiError;
        try {
          errorData = await response.json();
          console.log('❌ Error response data:', errorData);
        } catch {
          errorData = {
            success: false,
            error: `HTTP_${response.status}`,
            message: `HTTP ${response.status}`,
          };
        }

        // Handle token refresh on 401
        if (response.status === 401 && !options.skipAuth) {
          const refreshResult = await authTokenManager.refreshToken();
          if (refreshResult.success && refreshResult.tokens) {
            // Retry original request with new token
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${refreshResult.tokens.accessToken}`,
            };
            const retryResponse = await fetch(url, config);
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log('✅ Retry success response data:', retryData);
              return retryData;
            } else {
              const retryErrorData = await retryResponse.json();
              const retryError = new Error(
                retryErrorData.message || `HTTP ${retryResponse.status}`
              );
              
              // Classify the retry error
              const appError = ErrorHandler.classifyError(retryError, retryResponse);
              ErrorHandler.logError(appError, 'API_RETRY');
              
              throw retryError;
            }
          }
        }

        const httpError = new Error(errorData.message || `HTTP ${response.status}`);
        
        // Classify the HTTP error
        const appError = ErrorHandler.classifyError(httpError, response);
        ErrorHandler.logError(appError, 'API_HTTP');
        
        throw httpError;
      }

      const data = await response.json();
      console.log('✅ Success response data:', data);

      // Ensure response has required fields
      if (typeof data.success === 'undefined') {
        data.success = true;
      }
      if (!data.message) {
        data.message = 'Request completed successfully';
      }

      return data;
    } catch (error) {
      console.error('💥 API Error:', error);
      
      // Check for CORS issues first
      if (CorsHandler.detectCorsIssue(error, response)) {
        console.log('🚫 CORS issue detected');
        CorsHandler.logCorsError(this.corsConfig, error);
        
        // Attempt CORS fallback in production
        const envConfig = environmentConfig.getConfig();
        if (envConfig.isProduction) {
          console.log('🔄 Attempting CORS fallback...');
          const fallbackResult = await CorsHandler.attemptCorsFallback(url, config);
          
          if (fallbackResult.success && fallbackResult.response) {
            console.log('✅ CORS fallback succeeded');
            const fallbackData = await fallbackResult.response.json();
            return fallbackData;
          } else {
            console.log('❌ CORS fallback failed:', fallbackResult.error);
          }
        }
        
        const corsError = ErrorHandler.detectCorsError(error, response);
        if (corsError) {
          ErrorHandler.logError(corsError, 'API_CORS');
          const enhancedError = new Error(ErrorHandler.getUserMessage(corsError));
          (enhancedError as any).appError = corsError;
          throw enhancedError;
        }
      }
      
      // Classify the error using our error handler
      const appError = ErrorHandler.classifyError(error, response);
      ErrorHandler.logError(appError, 'API_REQUEST');
      
      // Create enhanced error response
      const enhancedError = new Error(ErrorHandler.getUserMessage(appError));
      (enhancedError as any).appError = appError;
      
      throw enhancedError;
    }
  }

  // Auth methods
  async register(userData: {
    name: string;
    email: string;
    password: string;
  }): Promise<ApiResponse> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      skipAuth: true,
    });
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<ApiResponse> {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuth: true,
    });

    // Note: Token storage is now handled by AuthContext to ensure proper synchronization
    // The API client no longer stores tokens directly to avoid race conditions
    
    return response;
  }

  async getProfile(): Promise<ApiResponse> {
    return this.request('/api/auth/me');
  }

  async logout(): Promise<ApiResponse> {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  // File upload
  async uploadFile(file: File): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request('/api/upload/', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    });
  }

  async getUploadProgress(uploadId: string): Promise<ApiResponse> {
    return this.request(`/api/upload/${uploadId}/progress`);
  }

  async cancelUpload(uploadId: string): Promise<ApiResponse> {
    return this.request(`/api/upload/${uploadId}`, {
      method: 'DELETE',
    });
  }

  // Orders
  async getOrders(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    status?: string;
  }): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.order) searchParams.set('order', params.order);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.request(`/api/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(orderId: string): Promise<ApiResponse> {
    return this.request(`/api/orders/${orderId}`);
  }

  async downloadOrder(
    orderId: string
  ): Promise<{ blob: Blob; filename?: string }> {
    const accessToken = await authTokenManager.getValidToken();
    
    const response = await fetch(
      `${this.baseURL}/api/orders/${orderId}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 410) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error('Download link expired');
      (error as any).code = 'DOWNLOAD_LINK_EXPIRED';
      (error as any).details = errorData;
      throw error;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || 'Download failed');
      (error as any).code =
        response.status === 404 ? 'ORDER_NOT_FOUND' : 'DOWNLOAD_FAILED';
      (error as any).status = response.status;
      (error as any).details = errorData;
      throw error;
    }

    // Extract filename from Content-Disposition header
    let filename: string | undefined;
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      // Handle various Content-Disposition formats
      // First try to match quoted filenames
      let filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]*)"/);
      if (!filenameMatch) {
        filenameMatch = contentDisposition.match(/filename\s*=\s*'([^']*)'/);
      }
      if (!filenameMatch) {
        // Try unquoted filename
        filenameMatch = contentDisposition.match(/filename\s*=\s*([^;\s]+)/);
      }

      if (filenameMatch && filenameMatch[1] && filenameMatch[1].length > 0) {
        filename = filenameMatch[1];
      }
    }

    const blob = await response.blob();
    return { blob, filename };
  }

  async retryOrder(orderId: string): Promise<ApiResponse> {
    return this.request(`/api/orders/${orderId}/retry`, {
      method: 'POST',
    });
  }

  // Payments
  async initiatePayment(
    orderId: string,
    options?: {
      return_url?: string;
      cancel_url?: string;
    }
  ): Promise<ApiResponse> {
    // Use environment-aware payment URLs
    const paymentUrls = environmentConfig.getPaymentUrls();
    const defaultOptions = {
      return_url: paymentUrls.returnUrl,
      cancel_url: paymentUrls.cancelUrl,
      ...options,
    };

    return this.request(`/api/payments/orders/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify(defaultOptions),
    });
  }

  async getPaymentStatus(paymentId: string): Promise<ApiResponse> {
    return this.request(`/api/payments/${paymentId}`);
  }

  // User management
  async updateProfile(data: {
    name?: string;
    email?: string;
  }): Promise<ApiResponse> {
    return this.request(`/api/users/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse> {
    return this.request(`/api/users/me/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserOrders(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
      status?: string;
    }
  ): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    if (params?.order) searchParams.set('order', params.order);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return this.request(
      `/api/users/${userId}/orders${query ? `?${query}` : ''}`
    );
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health', {
      skipAuth: true,
    });
  }

  // CORS diagnostic
  async diagnoseCors(): Promise<{
    success: boolean;
    corsTest?: any;
    diagnostic?: any;
    troubleshootingReport?: string;
  }> {
    try {
      // Test CORS configuration
      const corsTest = await CorsHandler.testCorsConfiguration(this.baseURL);
      
      // Get diagnostic information
      const diagnostic = CorsHandler.diagnoseCorsIssues(this.corsConfig);
      
      // Generate troubleshooting report
      const troubleshootingReport = CorsHandler.generateTroubleshootingReport(this.corsConfig);
      
      return {
        success: corsTest.success,
        corsTest,
        diagnostic,
        troubleshootingReport,
      };
    } catch (error) {
      console.error('❌ CORS diagnostic failed:', error);
      
      const troubleshootingReport = CorsHandler.generateTroubleshootingReport(this.corsConfig, error);
      
      return {
        success: false,
        troubleshootingReport,
      };
    }
  }

  // Getters
  get isAuthenticated(): boolean {
    // Use synchronous check - this will be used for quick checks
    // For more thorough checks, components should use AuthContext
    const tokens = authTokenManager.getStoredTokens();
    return !!(tokens.accessToken && tokens.refreshToken);
  }

  async getValidToken(): Promise<string | null> {
    return authTokenManager.getValidToken();
  }
}

export const apiClient = new ApiClient();
export default apiClient;
