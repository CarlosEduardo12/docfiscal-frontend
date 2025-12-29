// Core Data Models for DocFiscal Frontend

/**
 * User model representing authenticated users
 */
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Order status enumeration
 */
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Order model representing conversion requests
 */
export interface Order {
  id: string;
  user_id: string;
  filename: string;
  file_size: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string;
  download_url?: string;
  expires_at?: string;
  // Legacy fields for backward compatibility
  paymentUrl?: string;
  downloadUrl?: string;
  originalFileSize?: number;
  createdAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  // New API fields
  checkout_url?: string;
}

/**
 * File upload model for tracking upload progress
 */
export interface FileUpload {
  file: File;
  uploadId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

// API Request/Response Interfaces

/**
 * Authentication request interfaces
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

/**
 * User management interfaces
 */
export interface UpdateProfileData {
  name?: string;
  email?: string;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

/**
 * Upload service interfaces
 */
export interface UploadResponse {
  orderId: string;
  status: string;
  paymentUrl?: string;
  message: string;
}

export interface ProgressResponse {
  uploadId: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

/**
 * Order service interfaces
 */
export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderStatusResponse {
  order: Order;
  message: string;
}

/**
 * Payment service interfaces
 */
export interface PaymentResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  checkout_url: string;
  qr_code?: string;
  expires_at: string;
}

export interface PaymentStatus {
  payment_id: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  order_id: string;
  amount: number;
  currency: string;
  payment_method: 'pix' | 'credit_card';
  created_at: string;
  completed_at?: string;
  failure_reason?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

/**
 * API error interface
 */
export interface ApiError {
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

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
}

/**
 * File validation constraints
 */
export interface FileValidationConfig {
  maxFileSize: number; // in bytes
  acceptedFileTypes: string[];
  allowedExtensions: string[];
}

/**
 * Component prop interfaces
 */
export interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
  acceptedFileTypes: readonly string[];
  maxFileSize: number;
  disabled?: boolean;
}

export interface OrderStatusCardProps {
  order: Order;
  onPaymentClick: () => void;
  onDownloadClick: () => void;
  isLoading?: boolean;
}

export interface OrderHistoryTableProps {
  orders: Order[];
  onDownload: (orderId: string) => void;
  onPayment?: (orderId: string) => void;
  isLoading: boolean;
  pagination?: PaginationParams;
  onPageChange?: (page: number) => void;
}

export interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  isLoading: boolean;
  error?: string;
}

export interface RegisterFormProps {
  onSubmit: (userData: RegisterData) => void;
  isLoading: boolean;
  error?: string;
}
