// Core Data Models for DocFiscal Frontend

/**
 * User model representing authenticated users
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
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
  userId: string;
  filename: string;
  originalFileSize: number;
  status: OrderStatus;
  paymentId?: string;
  paymentUrl?: string;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
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
  paymentId: string;
  paymentUrl: string;
  status: string;
  message: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  orderId: string;
  amount: number;
  currency: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
}

/**
 * API error interface
 */
export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
