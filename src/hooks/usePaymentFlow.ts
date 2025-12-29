import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

export interface PaymentStatus {
  id: string;
  order_id: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  payment_method: 'pix' | 'credit_card';
  created_at: string;
  completed_at?: string;
  failure_reason?: string;
  error_message?: string;
}

export interface PaymentError {
  type:
    | 'NETWORK_ERROR'
    | 'VALIDATION_ERROR'
    | 'PAYMENT_FAILED'
    | 'EXPIRED'
    | 'CANCELLED'
    | 'UNKNOWN';
  message: string;
  details?: {
    field_errors?: Record<string, string[]>;
    retry_after?: number;
    guidance?: string;
  };
}

export interface PaymentFlowState {
  status:
    | 'idle'
    | 'initiating'
    | 'processing'
    | 'polling'
    | 'completed'
    | 'failed';
  paymentId?: string;
  orderId?: string;
  error?: PaymentError;
  checkoutUrl?: string;
  qrCode?: string;
  isLoading: boolean;
}

export interface UsePaymentFlowOptions {
  onSuccess?: (paymentId: string, orderId: string) => void;
  onError?: (error: PaymentError) => void;
  returnUrl?: string;
  cancelUrl?: string;
  pollingInterval?: number;
  maxPollingAttempts?: number;
}

export function usePaymentFlow(options: UsePaymentFlowOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef(0);

  const {
    onSuccess,
    onError,
    returnUrl,
    cancelUrl,
    pollingInterval = 3000, // 3 seconds
    maxPollingAttempts = 60, // 3 minutes total
  } = options;

  const [state, setState] = useState<PaymentFlowState>({
    status: 'idle',
    isLoading: false,
  });

  const [isPolling, setIsPolling] = useState(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleError = useCallback(
    (error: PaymentError) => {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error,
        isLoading: false,
      }));
      onError?.(error);
    },
    [onError]
  );

  const initiatePayment = useCallback(
    async (orderId: string) => {
      setState((prev) => ({
        ...prev,
        status: 'initiating',
        isLoading: true,
        error: undefined,
      }));

      try {
        // First validate order status
        const orderResponse = await apiClient.getOrder(orderId);

        if (!orderResponse.success || !orderResponse.data) {
          throw new Error('Order not found');
        }

        if (orderResponse.data.status !== 'pending_payment') {
          throw new Error(
            `Cannot initiate payment for order with status: ${orderResponse.data.status}`
          );
        }

        // Initiate payment using new endpoint format
        const paymentResponse = await apiClient.initiatePayment(orderId, {
          return_url: returnUrl || `${window.location.origin}/payment/success`,
          cancel_url: cancelUrl || `${window.location.origin}/payment/cancel`,
        });

        if (!paymentResponse.success || !paymentResponse.data) {
          const errorMessage =
            paymentResponse.message || 'Failed to create payment';
          throw new Error(errorMessage);
        }

        // Handle new response format with checkout_url and qr_code
        const { payment_id, checkout_url, qr_code, order_id } =
          paymentResponse.data;

        setState((prev) => ({
          ...prev,
          status: 'processing',
          paymentId: payment_id,
          orderId: order_id,
          checkoutUrl: checkout_url,
          qrCode: qr_code,
          isLoading: false,
        }));

        // Open checkout URL in new window/tab if available
        if (checkout_url) {
          window.open(checkout_url, '_blank', 'noopener,noreferrer');
        }

        return {
          paymentId: payment_id,
          checkoutUrl: checkout_url,
          qrCode: qr_code,
          orderId: order_id,
        };
      } catch (error) {
        const paymentError: PaymentError = {
          type: 'UNKNOWN',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };

        handleError(paymentError);
        throw error;
      }
    },
    [returnUrl, cancelUrl, handleError]
  );

  const startStatusPolling = useCallback(
    (paymentId: string) => {
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      setState((prev) => ({ ...prev, status: 'polling' }));
      setIsPolling(true);
      pollingAttemptsRef.current = 0;

      const pollPaymentStatus = async () => {
        try {
          pollingAttemptsRef.current += 1;

          // Check if we've exceeded max attempts
          if (pollingAttemptsRef.current >= maxPollingAttempts) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsPolling(false);

            const timeoutError: PaymentError = {
              type: 'UNKNOWN',
              message: 'Payment status polling timed out',
            };
            handleError(timeoutError);
            return;
          }

          // Use new payment status endpoint (without /status suffix)
          const response = await apiClient.getPaymentStatus(paymentId);

          if (!response.success || !response.data) {
            throw new Error(response.message || 'Failed to get payment status');
          }

          const paymentStatus: PaymentStatus = response.data;

          if (paymentStatus.status === 'paid') {
            // Stop polling first
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsPolling(false);

            // Payment completed successfully
            setState((prev) => ({
              ...prev,
              status: 'completed',
              isLoading: false,
            }));

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            if (paymentStatus.order_id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.orders.byId(paymentStatus.order_id),
              });
            }
            queryClient.invalidateQueries({
              queryKey: queryKeys.payments.byId(paymentId),
            });

            onSuccess?.(paymentId, paymentStatus.order_id);
          } else if (
            ['failed', 'cancelled', 'expired'].includes(paymentStatus.status)
          ) {
            // Stop polling first
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setIsPolling(false);

            // Payment failed
            const errorType =
              paymentStatus.status.toUpperCase() as PaymentError['type'];
            const paymentError: PaymentError = {
              type: errorType,
              message:
                paymentStatus.failure_reason ||
                paymentStatus.error_message ||
                `Payment ${paymentStatus.status}`,
            };

            handleError(paymentError);
          }
          // If status is still 'pending', continue polling
        } catch (error) {
          console.error('Payment status polling error:', error);

          // Don't stop polling on network errors, just log and continue
          // Only stop on max attempts reached
        }
      };

      // Start polling immediately, then at intervals
      pollPaymentStatus();
      pollingIntervalRef.current = setInterval(
        pollPaymentStatus,
        pollingInterval
      );
    },
    [maxPollingAttempts, pollingInterval, queryClient, onSuccess, handleError]
  );

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    pollingAttemptsRef.current = 0;
  }, []);

  const retryPayment = useCallback(async () => {
    if (!state.orderId) {
      throw new Error('No order ID available for retry');
    }

    return initiatePayment(state.orderId);
  }, [state.orderId, initiatePayment]);

  const getErrorResponse = useCallback(() => {
    if (!state.error) {
      return null;
    }

    // Return user-friendly error messages based on error type
    switch (state.error.type) {
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Error',
          message:
            'Unable to connect to payment service. Please check your internet connection and try again.',
          canRetry: true,
        };
      case 'VALIDATION_ERROR':
        return {
          title: 'Validation Error',
          message: state.error.message,
          canRetry: false,
        };
      case 'PAYMENT_FAILED':
        return {
          title: 'Payment Failed',
          message:
            state.error.message ||
            'Payment could not be processed. Please try again or use a different payment method.',
          canRetry: true,
        };
      case 'EXPIRED':
        return {
          title: 'Payment Expired',
          message:
            'The payment session has expired. Please start a new payment.',
          canRetry: true,
        };
      case 'CANCELLED':
        return {
          title: 'Payment Cancelled',
          message: 'The payment was cancelled. You can try again if needed.',
          canRetry: true,
        };
      default:
        return {
          title: 'Payment Error',
          message:
            state.error.message ||
            'An unexpected error occurred. Please try again.',
          canRetry: true,
        };
    }
  }, [state.error]);

  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: 'idle',
      isLoading: false,
    });
  }, [stopPolling]);

  return {
    state,
    initiatePayment,
    startStatusPolling,
    stopPolling,
    retryPayment,
    getErrorResponse,
    reset,
    // Computed values
    isPolling,
    currentInterval: pollingInterval,
    attempts: pollingAttemptsRef.current,
    maxAttempts: maxPollingAttempts,
  };
}
