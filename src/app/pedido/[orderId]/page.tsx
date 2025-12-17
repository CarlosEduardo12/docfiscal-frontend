'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrderStatusCard } from '@/components/order/OrderStatusCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { paymentService, orderService } from '@/lib/api';
import { useOrderStatus, useInvalidateQueries } from '@/lib/react-query';
import type { Order } from '@/types';

export default function OrderStatusPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isDownloadLoading, setIsDownloadLoading] = useState(false);

  // Fetch order data
  const {
    data: order,
    isLoading: orderLoading,
    error: orderError,
    refetch: refetchOrder,
  } = useOrderStatus(orderId, !!orderId && !!user);

  const { invalidateOrder } = useInvalidateQueries();

  const handlePaymentClick = async () => {
    if (!order) return;

    setIsPaymentLoading(true);
    try {
      if (order.paymentUrl) {
        // Direct redirect to existing payment URL
        window.open(order.paymentUrl, '_blank');
      } else {
        // Create new payment
        const paymentResponse = await paymentService.createPayment(order.id);
        if (paymentResponse.success && paymentResponse.data?.paymentUrl) {
          window.open(paymentResponse.data.paymentUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const handleDownloadClick = async () => {
    if (!order) return;

    setIsDownloadLoading(true);
    try {
      if (order.downloadUrl) {
        // Direct download from URL
        window.open(order.downloadUrl, '_blank');
      } else {
        // Download through service
        const blob = await orderService.downloadFile(order.id);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${order.filename.replace('.pdf', '')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloadLoading(false);
    }
  };

  if (authLoading || orderLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Order Not Found
            </h1>
            <p className="text-gray-600">
              The order you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have permission to view it.
            </p>
            <Button onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Order Status
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Track your PDF conversion progress
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="sm:size-default"
                onClick={() => {
                  refetchOrder();
                  invalidateOrder(orderId);
                }}
                disabled={orderLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${orderLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="sm:size-default"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>

        {/* Order Status Card */}
        <div className="space-y-6">
          <OrderStatusCard
            order={order}
            onPaymentClick={handlePaymentClick}
            onDownloadClick={handleDownloadClick}
            isLoading={isPaymentLoading || isDownloadLoading}
          />

          {/* Additional Information */}
          {order.status === 'processing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Processing Information
              </h3>
              <p className="text-sm text-blue-700">
                Your document is currently being processed. This typically takes
                2-5 minutes depending on the file size and complexity.
                You&apos;ll receive an email notification when it&apos;s ready
                for download.
              </p>
            </div>
          )}

          {order.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                Download Ready
              </h3>
              <p className="text-sm text-green-700">
                Your CSV file is ready! The download link will remain active for
                7 days. After that, you&apos;ll need to process the file again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
