const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.baseURL = API_BASE_URL;

    // Initialize tokens from localStorage if available
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth header if token exists and not explicitly skipped
    if (this.accessToken && !options.skipAuth) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${this.accessToken}`,
      };
    }

    try {
      console.log('🔄 Making request to:', url);
      console.log('📦 Request config:', config);

      const response = await fetch(url, config);
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
        if (response.status === 401 && this.refreshToken && !options.skipAuth) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry original request with new token
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${this.accessToken}`,
            };
            const retryResponse = await fetch(url, config);
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log('✅ Retry success response data:', retryData);
              return retryData;
            } else {
              const retryErrorData = await retryResponse.json();
              throw new Error(
                retryErrorData.message || `HTTP ${retryResponse.status}`
              );
            }
          }
        }

        throw new Error(errorData.message || `HTTP ${response.status}`);
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
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'Network error: Unable to connect to server. Please check if the backend is running.'
        );
      }
      throw error;
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

    if (response.success && (response.data as any)?.access_token) {
      this.setTokens(
        (response.data as any).access_token,
        (response.data as any).refresh_token
      );
    }

    return response;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await this.request('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        skipAuth: true,
      });

      if (response.success && (response.data as any)?.access_token) {
        this.setTokens(
          (response.data as any).access_token,
          (response.data as any).refresh_token || this.refreshToken
        );
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
    }

    return false;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getProfile(): Promise<ApiResponse> {
    return this.request('/api/auth/me');
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
    const response = await fetch(
      `${this.baseURL}/api/orders/${orderId}/download`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
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
    const defaultOptions = {
      return_url: process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL,
      cancel_url: process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL,
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

  // Token management
  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  // Getters
  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  get currentAccessToken(): string | null {
    return this.accessToken;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
