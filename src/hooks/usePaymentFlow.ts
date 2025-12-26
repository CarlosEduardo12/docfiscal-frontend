import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';
import { PaymentStatusPoller, PaymentStatus } from '@/components/payment/PaymentStatusPoller';
import { PaymentErrorHandler, PaymentError } from '@/components/payment/PaymentErrorHandler';

export interface PaymentFlowState {
  status: 'idle' | 'initiating' | 'processing' | 'polling' | 'completed' | 'failed';
  paymentId?: string;
  orderId?: string;
  error?: PaymentError;
  paymentUrl?: string;
  isLoading: boolean;
}

export interface UsePaymentFlowOptions {
  onSuccess?: (paymentId: string, orderId: string) => void;
  onError?: (error: PaymentError) => void;
  returnUrl?: string;
  cancelUrl?: string;
}

export function usePaymentFlow(options: UsePaymentFlowOptions = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollerRef = useRef<PaymentStatusPoller | null>(null);

  const [state, setState] = useState<PaymentFlowState>({
    status: 'idle',
    isLoading: false
  });

  // Cleanup poller on unmount
  useEffect(() => {
    return () => {
      if (pollerRef.current) {
        pollerRef.current.stopPolling();
      }
    };
  }, []);

  const initiatePayment = useCallback(async (orderId: string) => {
    setState(prev => ({ ...prev, status: 'initiating', isLoading: true, error: undefined }));

    try {
      // First validate order status
      const orderResponse = await apiClient.getOrder(orderId);
      
      if (!orderResponse.success || !orderResponse.data) {
        throw new Error('Order not found');
      }

      if (orderResponse.data.status !== 'pending_payment') {
        throw new Error(`Cannot initiate payment for order with status: ${orderResponse.data.status}`);
      }

      // Initiate payment
      const paymentResponse = await apiClient.initiatePayment(orderId, {
        return_url: options.returnUrl || `${window.location.origin}/payment/success`,
        cancel_url: options.cancelUrl || `${window.location.origin}/payment/cancel`
      });

      if (!paymentResponse.success || !paymentResponse.data) {
        throw new Error(paymentResponse.error || 'Failed to create payment');
      }

      const { payment_id, payment_url, order_id } = paymentResponse.data;

      setState(prev => ({
        ...prev,
        status: 'processing',
        paymentId: payment_id,
        orderId: order_id,
        paymentUrl: payment_url,
        isLoading: false
      }));

      // Open payment URL in new window/tab
      if (payment_url) {
        window.open(payment_url, '_blank', 'noopener,noreferrer');
      }

      return { paymentId: payment_id, paymentUrl: payment_url, orderId: order_id };

    } catch (error) {
      const paymentError: PaymentError = {
        type: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      setState(prev => ({
        ...prev,
        status: 'failed',
        error: paymentError,
        isLoading: false
      }));

      options.onError?.(paymentError);
      throw error;
    }
  }, [options.returnUrl, options.cancelUrl, options.onError]);

  const startStatusPolling = useCallback((paymentId: string) => {
    if (pollerRef.current) {
      pollerRef.current.stopPolling();
    }

    setState(prev => ({ ...prev, status: 'polling' }));

    pollerRef.current = new PaymentStatusPoller({
      paymentId,
      onStatusChange: (status: PaymentStatus) => {
        console.log('Payment status update:', status);

        if (status.status === 'paid') {
          // Payment completed successfully
          setState(prev => ({
            ...prev,
            status: 'completed',
            isLoading: false
          }));

          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          if (status.order_id) {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.byId(status.order_id) });
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.byId(paymentId) });

          options.onSuccess?.(paymentId, status.order_id);

        } else if (['failed', 'cancelled', 'expired'].includes(status.status)) {
          // Payment failed
          const errorType = status.status.toUpperCase() as PaymentError['type'];
          const paymentError: PaymentError = {
            type: errorType,
            message: status.error_message || `Payment ${status.status}`
          };

          setState(prev => ({
            ...prev,
            status: 'failed',
            error: paymentError,
            isLoading: false
          }));

          options.onError?.(paymentError);
        }
      },
      onError: (error: Error) => {
        const paymentError: PaymentError = {
          type: 'NETWORK_ERROR',
          message: error.message
        };

        setState(prev => ({
          ...prev,
          status: 'failed',
          error: paymentError,
          isLoading: false
        }));

        options.onError?.(paymentError);
      }
    });

    pollerRef.current.startPolling();
  }, [queryClient, options.onSuccess, options.onError]);

  const stopPolling = useCallback(() => {
    if (pollerRef.current) {
      pollerRef.current.stopPolling();
    }
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

    return PaymentErrorHandler.handlePaymentError(state.error);
  }, [state.error]);

  const reset = useCallback(() => {
    if (pollerRef.current) {
      pollerRef.current.stopPolling();
    }

    setState({
      status: 'idle',
      isLoading: false
    });
  }, []);

  return {
    state,
    initiatePayment,
    startStatusPolling,
    stopPolling,
    retryPayment,
    getErrorResponse,
    reset,
    // Computed values
    isPolling: pollerRef.current?.isActive() || false,
    currentInterval: pollerRef.current?.getCurrentInterval() || 0,
    attempts: pollerRef.current?.getAttempts() || 0
  };
}