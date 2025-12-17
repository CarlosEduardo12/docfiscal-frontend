import { z } from 'zod';
import type {
  User,
  Order,
  FileUpload,
  LoginCredentials,
  RegisterData,
  OrderStatus,
  PaginationParams,
} from '@/types';

// User validation schema
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<User>;

// Order status validation
export const OrderStatusSchema = z.enum([
  'pending_payment',
  'paid',
  'processing',
  'completed',
  'failed',
]) satisfies z.ZodType<OrderStatus>;

// Order validation schema
export const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  filename: z.string().min(1, 'Filename is required'),
  originalFileSize: z.number().positive('File size must be positive'),
  status: OrderStatusSchema,
  paymentId: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  downloadUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
}) satisfies z.ZodType<Order>;

// File upload validation schema
export const FileUploadSchema = z.object({
  file: z.instanceof(File),
  uploadId: z.string().uuid(),
  progress: z.number().min(0).max(100),
  status: z.enum(['uploading', 'completed', 'error']),
  errorMessage: z.string().optional(),
}) satisfies z.ZodType<FileUpload>;

// Authentication validation schemas
export const LoginCredentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
}) satisfies z.ZodType<LoginCredentials>;

export const RegisterDataSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
}) satisfies z.ZodType<RegisterData>;

// File validation schema
export const FileValidationSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.type === 'application/pdf', {
      message: 'Only PDF files are allowed',
    })
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      // 10MB limit
      message: 'File size must be less than 10MB',
    })
    .refine((file) => file.name.trim().length > 0, {
      message: 'File must have a name',
    }),
});

// Pagination validation schema
export const PaginationParamsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// API response validation schemas
export const ApiResponseSchema = <T>(dataSchema: z.ZodType<T>) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string(),
  });

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

// Upload response validation
export const UploadResponseSchema = z.object({
  orderId: z.string().uuid(),
  status: z.string(),
  paymentUrl: z.string().url().optional(),
  message: z.string(),
});

// Order list response validation
export const OrderListResponseSchema = z.object({
  orders: z.array(OrderSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

// Payment response validation
export const PaymentResponseSchema = z.object({
  paymentId: z.string(),
  paymentUrl: z.string().url(),
  status: z.string(),
  message: z.string(),
});

export const PaymentStatusSchema = z.object({
  paymentId: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3), // ISO currency code
});

// Validation helper functions
export const validateFile = (file: File) => {
  return FileValidationSchema.parse({ file });
};

export const validateLoginCredentials = (credentials: unknown) => {
  return LoginCredentialsSchema.parse(credentials);
};

export const validateRegisterData = (data: unknown) => {
  return RegisterDataSchema.parse(data);
};

export const validatePaginationParams = (params: unknown) => {
  return PaginationParamsSchema.parse(params);
};

// Type guards using Zod
export const isValidUser = (data: unknown): data is User => {
  return UserSchema.safeParse(data).success;
};

export const isValidOrder = (data: unknown): data is Order => {
  return OrderSchema.safeParse(data).success;
};

export const isValidOrderStatus = (status: unknown): status is OrderStatus => {
  return OrderStatusSchema.safeParse(status).success;
};

// Constants for validation
export const FILE_VALIDATION_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  acceptedFileTypes: ['application/pdf'],
  allowedExtensions: ['.pdf'],
} as const;

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 10,
  sortOrder: 'desc' as const,
} as const;
