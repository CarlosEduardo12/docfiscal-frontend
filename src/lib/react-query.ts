import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import {
  authService,
  uploadService,
  orderService,
  paymentService,
  userService,
  retryRequest,
  isNetworkError,
  handleApiError,
} from '@/lib/api';
import type {
  User,
  Order,
  LoginCredentials,
  RegisterData,
  PaginationParams,
  UploadResponse,
  PaymentResponse,
} from '@/types';

// Create persister for localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'docfiscal-query-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Query client configuration with enhanced caching and persistence
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours for better persistence
      retry: (failureCount, error) => {
        // Retry network errors up to 3 times
        if (isNetworkError(error) && failureCount < 3) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Enable background refetching for better UX
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations by default, except for network errors
        if (isNetworkError(error) && failureCount < 2) {
          return true;
        }
        return false;
      },
    },
  },
});

// Initialize persistence for the query client
if (typeof window !== 'undefined') {
  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    buster: 'docfiscal-v1', // Change this to invalidate old cache
    dehydrateOptions: {
      // Only persist certain query types
      shouldDehydrateQuery: (query) => {
        const queryKey = query.queryKey[0] as string;
        // Persist user data, orders, and other important state
        return ['auth', 'orders', 'users'].includes(queryKey);
      },
    },
  });
}

// Query keys for consistent caching
export const queryKeys = {
  auth: {
    currentUser: ['auth', 'currentUser'] as const,
  },
  orders: {
    all: ['orders'] as const,
    byUser: (userId: string) => ['orders', 'user', userId] as const,
    byId: (orderId: string) => ['orders', orderId] as const,
    userOrders: (userId: string, params?: PaginationParams) =>
      ['orders', 'user', userId, params] as const,
  },
  users: {
    all: ['users'] as const,
    byId: (userId: string) => ['users', userId] as const,
  },
  payments: {
    all: ['payments'] as const,
    byId: (paymentId: string) => ['payments', paymentId] as const,
  },
  uploads: {
    all: ['uploads'] as const,
    progress: (uploadId: string) => ['uploads', 'progress', uploadId] as const,
  },
} as const;

// Authentication hooks
export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.auth.currentUser,
    queryFn: async () => {
      const response = await authService.getCurrentUser();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get current user');
      }
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for user data
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await authService.login(credentials);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Cache the user data
      queryClient.setQueryData(queryKeys.auth.currentUser, data.user);
      // Invalidate and refetch user-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: (error) => {
      console.error('Login failed:', handleApiError(error));
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: RegisterData) => {
      const response = await authService.register(userData);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Cache the user data
      queryClient.setQueryData(queryKeys.auth.currentUser, data.user);
    },
    onError: (error) => {
      console.error('Registration failed:', handleApiError(error));
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await authService.logout();
      if (!response.success) {
        throw new Error(response.error || 'Logout failed');
      }
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });
};

// Order hooks
export const useOrderStatus = (orderId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: queryKeys.orders.byId(orderId),
    queryFn: async () => {
      const response = await orderService.getOrderStatus(orderId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get order status');
      }
      return response.data;
    },
    enabled: enabled && !!orderId,
    refetchInterval: (query) => {
      // Poll every 5 seconds for processing orders
      const data = query.state.data;
      if (data?.status === 'processing' || data?.status === 'paid') {
        return 5000;
      }
      return false;
    },
  });
};

export const useUserOrders = (userId: string, params?: PaginationParams) => {
  return useQuery({
    queryKey: queryKeys.orders.userOrders(userId, params),
    queryFn: async () => {
      const response = await orderService.getUserOrders(userId, params);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get user orders');
      }
      return response.data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes for order lists
  });
};

export const useRetryOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await orderService.retryOrder(orderId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to retry order');
      }
      return response.data;
    },
    onSuccess: (data, orderId) => {
      // Update the specific order in cache
      queryClient.setQueryData(queryKeys.orders.byId(orderId), data);
      // Invalidate user orders to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
};

// Upload hooks
export const useFileUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      const response = await uploadService.uploadFile(file, onProgress);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Upload failed');
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate orders to show the new upload
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: (error) => {
      console.error('Upload failed:', handleApiError(error));
    },
  });
};

export const useUploadProgress = (
  uploadId: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: queryKeys.uploads.progress(uploadId),
    queryFn: async () => {
      const response = await uploadService.getUploadProgress(uploadId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get upload progress');
      }
      return response.data;
    },
    enabled: enabled && !!uploadId,
    refetchInterval: (query) => {
      // Poll every second while uploading
      const data = query.state.data;
      if (data?.status === 'uploading') {
        return 1000;
      }
      return false;
    },
  });
};

// Payment hooks
export const useCreatePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await paymentService.createPayment(orderId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create payment');
      }
      return response.data;
    },
    onSuccess: (data, orderId) => {
      // Invalidate the order to refresh payment status
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.byId(orderId),
      });
    },
  });
};

export const usePaymentStatus = (
  paymentId: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: queryKeys.payments.byId(paymentId),
    queryFn: async () => {
      const response = await paymentService.getPaymentStatus(paymentId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get payment status');
      }
      return response.data;
    },
    enabled: enabled && !!paymentId,
    refetchInterval: (query) => {
      // Poll every 10 seconds for pending payments
      const data = query.state.data;
      if (data?.status === 'pending') {
        return 10000;
      }
      return false;
    },
  });
};

// File download hook
export const useDownloadFile = () => {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const blob = await orderService.downloadFile(orderId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `converted-${orderId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
    },
    onError: (error) => {
      console.error('Download failed:', handleApiError(error));
    },
  });
};

// User profile hooks
export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.users.byId(userId),
    queryFn: async () => {
      const response = await userService.getUserProfile(userId);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get user profile');
      }
      return response.data;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes for user profiles
  });
};

export const useUpdateUserProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      userData,
    }: {
      userId: string;
      userData: Partial<User>;
    }) => {
      const response = await userService.updateUserProfile(userId, userData);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update user profile');
      }
      return response.data;
    },
    onSuccess: (data, { userId }) => {
      // Update user profile in cache
      queryClient.setQueryData(queryKeys.users.byId(userId), data);
      // Update current user if it's the same user
      queryClient.setQueryData(queryKeys.auth.currentUser, data);
    },
  });
};

// Utility hooks for cache management
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  return {
    invalidateOrders: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    invalidateUserOrders: (userId: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.byUser(userId),
      }),
    invalidateOrder: (orderId: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.byId(orderId),
      }),
    invalidateCurrentUser: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};

// Prefetch utilities for performance optimization
export const usePrefetchQueries = () => {
  const queryClient = useQueryClient();

  return {
    prefetchUserOrders: async (userId: string, params?: PaginationParams) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.orders.userOrders(userId, params),
        queryFn: async () => {
          const response = await orderService.getUserOrders(userId, params);
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to prefetch user orders');
          }
          return response.data;
        },
        staleTime: 2 * 60 * 1000,
      });
    },

    prefetchOrderStatus: async (orderId: string) => {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.orders.byId(orderId),
        queryFn: async () => {
          const response = await orderService.getOrderStatus(orderId);
          if (!response.success || !response.data) {
            throw new Error(
              response.error || 'Failed to prefetch order status'
            );
          }
          return response.data;
        },
      });
    },
  };
};
