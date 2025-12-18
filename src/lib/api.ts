const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: {
    field_errors?: Record<string, string[]>;
    error_count?: number;
    retry_after?: number;
  };
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
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Try to parse error response
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}` };
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
            return await retryResponse.json();
          }
        }

        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
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

    if (response.success && (response.data as any)?.tokens) {
      this.setTokens(
        (response.data as any).tokens.access_token,
        (response.data as any).tokens.refresh_token
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

      if (response.success && (response.data as any)?.tokens) {
        this.setTokens(
          (response.data as any).tokens.access_token,
          (response.data as any).tokens.refresh_token || this.refreshToken
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

    return this.request('/api/upload', {
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
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);

    const query = searchParams.toString();
    return this.request(`/api/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(orderId: string): Promise<ApiResponse> {
    return this.request(`/api/orders/${orderId}`);
  }

  async downloadOrder(orderId: string): Promise<Blob> {
    const response = await fetch(
      `${this.baseURL}/api/orders/${orderId}/download`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
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

    return this.request(`/api/orders/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify(defaultOptions),
    });
  }

  async getPaymentStatus(paymentId: string): Promise<ApiResponse> {
    return this.request(`/api/payments/${paymentId}/status`);
  }

  // User management
  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
    }
  ): Promise<ApiResponse> {
    return this.request(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserOrders(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }
  ): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);

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
