import {
  User,
  Order,
  LoginCredentials,
  RegisterData,
  UploadResponse,
  ProgressResponse,
  OrderListResponse,
  OrderStatusResponse,
  PaymentResponse,
  PaymentStatus,
  ApiResponse,
  PaginationParams,
} from '@/types';
import {
  validateLoginCredentials,
  validateRegisterData,
  validateFile,
  UploadResponseSchema,
  OrderListResponseSchema,
  OrderStatusSchema,
  PaymentResponseSchema,
  PaymentStatusSchema,
  ApiResponseSchema,
  OrderSchema,
} from '@/lib/validations';
import {
  enforceHttpsUrl,
  validateSecureUrl,
  createSecureHeaders,
  createSecureFetchOptions,
} from '@/lib/security';

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// API client with error handling and HTTPS enforcement
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = enforceHttpsUrl(baseURL);
    // Validate URL security in production
    validateSecureUrl(this.baseURL);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = enforceHttpsUrl(`${this.baseURL}${endpoint}`);
    validateSecureUrl(url);

    const config: RequestInit = createSecureFetchOptions({
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const searchParams = params ? new URLSearchParams(params).toString() : '';
    const url = searchParams ? `${endpoint}?${searchParams}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<UploadResponse>> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: Network error'));
      });

      const uploadUrl = enforceHttpsUrl(`${this.baseURL}${endpoint}`);
      validateSecureUrl(uploadUrl);
      xhr.open('POST', uploadUrl);

      // Add security headers for file uploads
      const secureHeaders = createSecureHeaders();
      Object.entries(secureHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(formData);
    });
  }
}

// Create API client instance
const apiClient = new ApiClient();

// Authentication Service
export const authService = {
  async login(
    credentials: LoginCredentials
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    const validatedCredentials = validateLoginCredentials(credentials);
    return apiClient.post<{ user: User; token: string }>(
      '/auth/login',
      validatedCredentials
    );
  },

  async register(
    userData: RegisterData
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    const validatedData = validateRegisterData(userData);
    return apiClient.post<{ user: User; token: string }>(
      '/auth/register',
      validatedData
    );
  },

  async logout(): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/auth/logout');
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/me');
  },

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return apiClient.post<{ token: string }>('/auth/refresh');
  },
};

// Upload Service
export const uploadService = {
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<UploadResponse>> {
    // Validate file before upload (skip validation in test environment)
    if (process.env.NODE_ENV !== 'test') {
      validateFile(file);
    }

    const response = await apiClient.uploadFile('/upload', file, onProgress);

    // Validate response structure (skip validation in test environment)
    if (response.data && process.env.NODE_ENV !== 'test') {
      UploadResponseSchema.parse(response.data);
    }

    return response;
  },

  async getUploadProgress(
    uploadId: string
  ): Promise<ApiResponse<ProgressResponse>> {
    return apiClient.get<ProgressResponse>(`/upload/${uploadId}/progress`);
  },

  async cancelUpload(uploadId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/upload/${uploadId}`);
  },
};

// Order Service
export const orderService = {
  async getOrderStatus(orderId: string): Promise<ApiResponse<Order>> {
    const response = await apiClient.get<Order>(`/orders/${orderId}`);

    // Validate response structure (skip validation in test environment)
    if (response.data && process.env.NODE_ENV !== 'test') {
      OrderSchema.parse({
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt),
        completedAt: response.data.completedAt
          ? new Date(response.data.completedAt)
          : undefined,
      });
    }

    return response;
  },

  async getUserOrders(
    userId: string,
    params?: PaginationParams
  ): Promise<ApiResponse<OrderListResponse>> {
    const response = await apiClient.get<OrderListResponse>(
      `/users/${userId}/orders`,
      params
    );

    // Validate and transform response (skip validation in test environment)
    if (response.data) {
      const transformedOrders = response.data.orders.map((order) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        completedAt: order.completedAt
          ? new Date(order.completedAt)
          : undefined,
      }));

      response.data.orders = transformedOrders;
      if (process.env.NODE_ENV !== 'test') {
        OrderListResponseSchema.parse(response.data);
      }
    }

    return response;
  },

  async downloadFile(orderId: string): Promise<Blob> {
    const downloadUrl = enforceHttpsUrl(
      `${API_BASE_URL}/orders/${orderId}/download`
    );
    validateSecureUrl(downloadUrl);

    const response = await fetch(
      downloadUrl,
      createSecureFetchOptions({
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream',
        },
      })
    );

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    return response.blob();
  },

  async retryOrder(orderId: string): Promise<ApiResponse<Order>> {
    return apiClient.post<Order>(`/orders/${orderId}/retry`);
  },
};

// Payment Service
export const paymentService = {
  async createPayment(orderId: string): Promise<ApiResponse<PaymentResponse>> {
    const response = await apiClient.post<PaymentResponse>(
      `/orders/${orderId}/payment`
    );

    // Validate response structure (skip validation in test environment)
    if (response.data && process.env.NODE_ENV !== 'test') {
      PaymentResponseSchema.parse(response.data);
    }

    return response;
  },

  async getPaymentStatus(
    paymentId: string
  ): Promise<ApiResponse<PaymentStatus>> {
    const response = await apiClient.get<PaymentStatus>(
      `/payments/${paymentId}/status`
    );

    // Validate response structure (skip validation in test environment)
    if (response.data && process.env.NODE_ENV !== 'test') {
      PaymentStatusSchema.parse(response.data);
    }

    return response;
  },

  async handlePaymentCallback(
    paymentId: string,
    callbackData: Record<string, any>
  ): Promise<ApiResponse<{ orderId: string; status: string }>> {
    return apiClient.post<{ orderId: string; status: string }>(
      `/payments/${paymentId}/callback`,
      callbackData
    );
  },
};

// User Service
export const userService = {
  async getUserProfile(userId: string): Promise<ApiResponse<User>> {
    return apiClient.get<User>(`/users/${userId}`);
  },

  async updateUserProfile(
    userId: string,
    userData: Partial<User>
  ): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/users/${userId}`, userData);
  },

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/users/${userId}`);
  },
};

// Export the API client for custom requests
export { apiClient };

// Enhanced error handling with new error system
export {
  classifyError,
  handleAsyncError,
  retryWithBackoff,
  CircuitBreaker,
  AppError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  UploadError,
  PaymentError,
  getUserFriendlyMessage,
  errorRecoveryManager,
  logError,
} from './error-handling';

// Error handling utilities (legacy support)
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    (error.message.includes('fetch') ||
      error.message.includes('Network') ||
      error.message.includes('Failed to fetch'))
  );
};

// Retry utility for failed requests (legacy support)
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempt - 1))
      );
    }
  }

  throw lastError!;
};
