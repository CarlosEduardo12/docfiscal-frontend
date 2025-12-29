import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getOrder: jest.fn(),
    initiatePayment: jest.fn(),
    getPaymentStatus: jest.fn(),
  },
}));

jest.mock('@/lib/react-query', () => ({
  queryKeys: {
    orders: {
      all: ['orders'],
      byId: (id: string) => ['orders', id],
    },
    payments: {
      byId: (id: string) => ['payments', id],
    },
  },
}));

const mockRouter = {
  push: jest.fn(),
};

const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<
  typeof useQueryClient
>;

// Mock timers
jest.useFakeTimers();

describe('usePaymentFlow Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockUseQueryClient.mockReturnValue(mockQueryClient as any);

    // Reset fake timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => usePaymentFlow());

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.paymentId).toBeUndefined();
      expect(result.current.state.orderId).toBeUndefined();
      expect(result.current.state.error).toBeUndefined();
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('Payment Initiation', () => {
    it('should initiate payment successfully', async () => {
      const mockOrder = {
        id: 'order123',
        status: 'pending_payment',
        filename: 'test.pdf',
        file_size: 1024,
        user_id: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockPaymentResponse = {
        success: true,
        data: {
          payment_id: 'payment123',
          order_id: 'order123',
          checkout_url: 'https://checkout.example.com/payment123',
          qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          status: 'pending',
          expires_at: '2023-01-01T01:00:00Z',
        },
        message: 'Payment initiated successfully',
      };

      mockApiClient.getOrder.mockResolvedValue({
        success: true,
        data: mockOrder,
        message: 'Order retrieved',
      });

      mockApiClient.initiatePayment.mockResolvedValue(mockPaymentResponse);

      // Mock window.open
      const mockWindowOpen = jest.fn();
      Object.defineProperty(window, 'open', { value: mockWindowOpen });

      const { result } = renderHook(() => usePaymentFlow());

      let paymentResult;
      await act(async () => {
        paymentResult = await result.current.initiatePayment('order123');
      });

      expect(result.current.state.status).toBe('processing');
      expect(result.current.state.paymentId).toBe('payment123');
      expect(result.current.state.orderId).toBe('order123');
      expect(result.current.state.checkoutUrl).toBe(
        'https://checkout.example.com/payment123'
      );
      expect(result.current.state.qrCode).toBe(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      );
      expect(result.current.state.isLoading).toBe(false);

      expect(paymentResult).toEqual({
        paymentId: 'payment123',
        checkoutUrl: 'https://checkout.example.com/payment123',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        orderId: 'order123',
      });

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://checkout.example.com/payment123',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should handle order not found error', async () => {
      mockApiClient.getOrder.mockResolvedValue({
        success: false,
        message: 'Order not found',
      });

      const onError = jest.fn();
      const { result } = renderHook(() => usePaymentFlow({ onError }));

      await act(async () => {
        try {
          await result.current.initiatePayment('nonexistent');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error?.message).toBe('Order not found');
      expect(onError).toHaveBeenCalledWith({
        type: 'UNKNOWN',
        message: 'Order not found',
      });
    });

    it('should handle invalid order status', async () => {
      const mockOrder = {
        id: 'order123',
        status: 'completed',
        filename: 'test.pdf',
        file_size: 1024,
        user_id: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockApiClient.getOrder.mockResolvedValue({
        success: true,
        data: mockOrder,
        message: 'Order retrieved',
      });

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        try {
          await result.current.initiatePayment('order123');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error?.message).toBe(
        'Cannot initiate payment for order with status: completed'
      );
    });

    it('should handle payment initiation failure', async () => {
      const mockOrder = {
        id: 'order123',
        status: 'pending_payment',
        filename: 'test.pdf',
        file_size: 1024,
        user_id: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockApiClient.getOrder.mockResolvedValue({
        success: true,
        data: mockOrder,
        message: 'Order retrieved',
      });

      mockApiClient.initiatePayment.mockResolvedValue({
        success: false,
        message: 'Payment initiation failed',
      });

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        try {
          await result.current.initiatePayment('order123');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error?.message).toBe(
        'Payment initiation failed'
      );
    });
  });

  describe('Payment Status Polling', () => {
    it('should poll payment status and handle successful payment', async () => {
      const mockPaymentStatus = {
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'paid',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
          completed_at: '2023-01-01T00:30:00Z',
        },
        message: 'Payment status retrieved',
      };

      mockApiClient.getPaymentStatus.mockResolvedValue(mockPaymentStatus);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => usePaymentFlow({ onSuccess }));

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      expect(result.current.state.status).toBe('polling');
      expect(result.current.isPolling).toBe(true);

      // Fast-forward time to trigger polling
      await act(async () => {
        jest.advanceTimersByTime(100); // Initial poll
        await Promise.resolve(); // Allow promises to resolve
      });

      expect(result.current.state.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
      expect(onSuccess).toHaveBeenCalledWith('payment123', 'order123');
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.orders.all,
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.orders.byId('order123'),
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.payments.byId('payment123'),
      });
    });

    it('should handle failed payment status', async () => {
      const mockPaymentStatus = {
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'failed',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
          failure_reason: 'Insufficient funds',
        },
        message: 'Payment status retrieved',
      };

      mockApiClient.getPaymentStatus.mockResolvedValue(mockPaymentStatus);

      const onError = jest.fn();
      const { result } = renderHook(() => usePaymentFlow({ onError }));

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      // Fast-forward time to trigger polling
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error?.type).toBe('FAILED');
      expect(result.current.state.error?.message).toBe('Insufficient funds');
      expect(result.current.isPolling).toBe(false);
      expect(onError).toHaveBeenCalledWith({
        type: 'FAILED',
        message: 'Insufficient funds',
      });
    });

    it('should continue polling for pending payments', async () => {
      const mockPaymentStatus = {
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'pending',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
        },
        message: 'Payment status retrieved',
      };

      mockApiClient.getPaymentStatus.mockResolvedValue(mockPaymentStatus);

      const { result } = renderHook(() => usePaymentFlow());

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      // Fast-forward time to trigger multiple polls
      await act(async () => {
        jest.advanceTimersByTime(100); // Initial poll
        await Promise.resolve();
        jest.advanceTimersByTime(3000); // Second poll
        await Promise.resolve();
      });

      expect(result.current.state.status).toBe('polling');
      expect(result.current.isPolling).toBe(true);
      expect(mockApiClient.getPaymentStatus).toHaveBeenCalledTimes(2);
    });

    it('should stop polling after max attempts', async () => {
      const mockPaymentStatus = {
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'pending',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
        },
        message: 'Payment status retrieved',
      };

      mockApiClient.getPaymentStatus.mockResolvedValue(mockPaymentStatus);

      const onError = jest.fn();
      const { result } = renderHook(() =>
        usePaymentFlow({
          onError,
          maxPollingAttempts: 2,
        })
      );

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      // Fast-forward time to exceed max attempts
      await act(async () => {
        jest.advanceTimersByTime(100); // First poll
        await Promise.resolve();
        jest.advanceTimersByTime(3000); // Second poll
        await Promise.resolve();
        jest.advanceTimersByTime(3000); // Third poll (should trigger timeout)
        await Promise.resolve();
      });

      expect(result.current.state.status).toBe('failed');
      expect(result.current.state.error?.message).toBe(
        'Payment status polling timed out'
      );
      expect(onError).toHaveBeenCalledWith({
        type: 'UNKNOWN',
        message: 'Payment status polling timed out',
      });
    });

    it('should handle polling errors gracefully', async () => {
      mockApiClient.getPaymentStatus.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => usePaymentFlow());

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      // Fast-forward time to trigger polling
      await act(async () => {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
        jest.advanceTimersByTime(3000); // Should continue polling despite error
        await Promise.resolve();
      });

      // Should continue polling despite network errors
      expect(result.current.state.status).toBe('polling');
      expect(result.current.isPolling).toBe(true);
    });
  });

  describe('Polling Control', () => {
    it('should stop polling when requested', () => {
      // Mock the payment status API call for polling
      mockApiClient.getPaymentStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'pending',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
        },
        message: 'Payment status retrieved',
      });

      const { result } = renderHook(() => usePaymentFlow());

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      expect(result.current.isPolling).toBe(true);

      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('should cleanup polling on unmount', () => {
      // Mock the payment status API call for polling
      mockApiClient.getPaymentStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'pending',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
        },
        message: 'Payment status retrieved',
      });

      const { result, unmount } = renderHook(() => usePaymentFlow());

      act(() => {
        result.current.startStatusPolling('payment123');
      });

      expect(result.current.isPolling).toBe(true);

      unmount();

      // Polling should be cleaned up
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('Payment Retry', () => {
    it('should retry payment with existing order ID', async () => {
      const mockOrder = {
        id: 'order123',
        status: 'pending_payment',
        filename: 'test.pdf',
        file_size: 1024,
        user_id: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockPaymentResponse = {
        success: true,
        data: {
          payment_id: 'payment456',
          order_id: 'order123',
          checkout_url: 'https://checkout.example.com/payment456',
          qr_code: 'data:image/png;base64,retry...',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          status: 'pending',
          expires_at: '2023-01-01T01:00:00Z',
        },
        message: 'Payment initiated successfully',
      };

      mockApiClient.getOrder.mockResolvedValue({
        success: true,
        data: mockOrder,
        message: 'Order retrieved',
      });

      mockApiClient.initiatePayment.mockResolvedValue(mockPaymentResponse);

      const { result } = renderHook(() => usePaymentFlow());

      // First initiate a payment to set the order ID
      await act(async () => {
        await result.current.initiatePayment('order123');
      });

      // Now retry the payment
      await act(async () => {
        await result.current.retryPayment();
      });

      expect(result.current.state.paymentId).toBe('payment456');
      expect(result.current.state.orderId).toBe('order123');
      expect(mockApiClient.initiatePayment).toHaveBeenCalledTimes(2);
    });

    it('should handle retry without order ID', async () => {
      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        try {
          await result.current.retryPayment();
        } catch (error) {
          expect(error).toEqual(new Error('No order ID available for retry'));
        }
      });
    });
  });

  describe('Error Response Handling', () => {
    it('should return appropriate error responses', async () => {
      const { result } = renderHook(() => usePaymentFlow());

      // Test network error
      mockApiClient.getOrder.mockResolvedValue({
        success: true,
        data: {
          id: 'order123',
          status: 'pending_payment',
          filename: 'test.pdf',
          file_size: 1024,
          user_id: 'user123',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        message: 'Order retrieved',
      });

      mockApiClient.initiatePayment.mockRejectedValue(
        new Error('Connection failed')
      );

      await act(async () => {
        try {
          await result.current.initiatePayment('order123');
        } catch (error) {
          // Expected to throw
        }
      });

      let errorResponse = result.current.getErrorResponse();
      expect(errorResponse?.title).toBe('Payment Error');
      expect(errorResponse?.canRetry).toBe(true);

      // Test validation error by mocking a different error response
      mockApiClient.initiatePayment.mockResolvedValue({
        success: false,
        message: 'Invalid payment data',
      });

      await act(async () => {
        try {
          await result.current.initiatePayment('order123');
        } catch (error) {
          // Expected to throw
        }
      });

      errorResponse = result.current.getErrorResponse();
      expect(errorResponse?.title).toBe('Payment Error');
      expect(errorResponse?.canRetry).toBe(true);
    });

    it('should return null when no error', () => {
      const { result } = renderHook(() => usePaymentFlow());

      const errorResponse = result.current.getErrorResponse();
      expect(errorResponse).toBe(null);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset state and stop polling', async () => {
      // Mock the payment status API call for polling
      mockApiClient.getPaymentStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'payment123',
          order_id: 'order123',
          status: 'pending',
          amount: 1000,
          currency: 'BRL',
          payment_method: 'pix',
          created_at: '2023-01-01T00:00:00Z',
        },
        message: 'Payment status retrieved',
      });

      const { result } = renderHook(() => usePaymentFlow());

      // Start polling first
      act(() => {
        result.current.startStatusPolling('payment123');
      });

      expect(result.current.isPolling).toBe(true);

      // Reset should stop polling and clear state
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.paymentId).toBeUndefined();
      expect(result.current.state.error).toBeUndefined();
      expect(result.current.isPolling).toBe(false);
    });
  });
});
