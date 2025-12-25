'use client';

import { useRequireAuth } from '@/hooks/useAuthNew';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrderStatusCard } from '@/components/order/OrderStatusCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useOrderStatus, useInvalidateQueries } from '@/lib/react-query';

export default function OrderStatusPage() {
  const { user, isLoading: authLoading, logout } = useRequireAuth();
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

    console.log('🔄 Iniciando pagamento para order:', order.id);
    setIsPaymentLoading(true);
    
    try {
      if (order.paymentUrl) {
        console.log('✅ Usando URL de pagamento existente:', order.paymentUrl);
        // Direct redirect to existing payment URL
        const opened = window.open(order.paymentUrl, '_blank');
        if (!opened) {
          alert(`Pop-up bloqueado! URL: ${order.paymentUrl}`);
        }
      } else {
        console.log('🔄 Criando nova URL de pagamento...');
        // Create new payment
        const paymentResponse = await apiClient.initiatePayment(order.id);
        console.log('📡 Resposta da API:', paymentResponse);
        
        if (paymentResponse.success && paymentResponse.data?.payment_url) {
          console.log('✅ Nova URL de pagamento criada:', paymentResponse.data.payment_url);
          const opened = window.open(paymentResponse.data.payment_url, '_blank');
          if (!opened) {
            alert(`Pop-up bloqueado! URL: ${paymentResponse.data.payment_url}`);
          }
        } else {
          console.error('❌ Erro na resposta da API:', paymentResponse);
          alert(`Erro: ${paymentResponse.message || 'Falha ao criar URL de pagamento'}`);
        }
      }
    } catch (error: any) {
      console.error('💥 Erro no pagamento:', error);
      alert(`Erro de conexão: ${error.message || 'Erro desconhecido'}`);
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
        const blob = await apiClient.downloadOrder(order.id);
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <AppLayout user={user} onLogout={logout}>
        <div className="max-w-4xl">
          <div className="text-center space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Order Not Found
              </h1>
              <p className="text-gray-600 mb-4">
                The order you&apos;re looking for doesn&apos;t exist or you
                don&apos;t have permission to view it.
              </p>
            </div>

            {orderError && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-yellow-900 mb-2">
                    Debug Information
                  </h3>
                  <div className="text-sm text-yellow-700 space-y-2">
                    <p>
                      <strong>Order ID:</strong> {orderId}
                    </p>
                    <p>
                      <strong>Error:</strong> {orderError.message}
                    </p>
                    <p>
                      <strong>User ID:</strong> {user?.id}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <p className="text-sm text-gray-500">Possible reasons:</p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>The order ID is incorrect or expired</li>
                <li>The order belongs to a different user</li>
                <li>There was an issue during the upload process</li>
                <li>The backend service is temporarily unavailable</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                View All Orders
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order Status</h1>
              <p className="text-gray-600">
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
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
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
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Processing Information
                </h3>
                <p className="text-sm text-blue-700">
                  Your document is currently being processed. This typically
                  takes 2-5 minutes depending on the file size and complexity.
                  You&apos;ll receive an email notification when it&apos;s ready
                  for download.
                </p>
              </CardContent>
            </Card>
          )}

          {order.status === 'completed' && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-green-900 mb-3">
                  🎉 Download Ready!
                </h3>
                <div className="space-y-3">
                  <p className="text-sm text-green-700">
                    Your CSV file has been successfully converted and is ready
                    for download.
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">
                      How to download:
                    </h4>
                    <ol className="text-sm text-green-700 space-y-1 list-decimal list-inside">
                      <li>Click the &quot;Download CSV&quot; button above</li>
                      <li>The file will be saved to your Downloads folder</li>
                      <li>Open with Excel, Google Sheets, or any CSV viewer</li>
                    </ol>
                  </div>
                  <p className="text-xs text-green-600">
                    💡 The download link will remain active for 7 days. After
                    that, you&apos;ll need to process the file again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {order.status === 'pending_payment' && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-yellow-900 mb-3">
                  💳 Payment Required
                </h3>
                <div className="space-y-3">
                  <p className="text-sm text-yellow-700">
                    Complete the payment to start processing your document.
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      Next steps:
                    </h4>
                    <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                      <li>Click &quot;Complete Payment&quot; button above</li>
                      <li>
                        You&apos;ll be redirected to our secure payment page
                      </li>
                      <li>
                        After payment, processing will begin automatically
                      </li>
                      <li>
                        You&apos;ll receive an email when your file is ready
                      </li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
