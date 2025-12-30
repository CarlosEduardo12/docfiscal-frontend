'use client';

import { useRequireAuth } from '@/contexts/AuthContext';
import {
  useOrdersRefresh,
  usePendingPaymentsMonitor,
} from '@/hooks/useOrdersRefresh';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { OrderHistoryTable } from '@/components/order/OrderHistoryTable';
import { useUserOrders, useDownloadFile } from '@/lib/react-query';
import { apiClient } from '@/lib/api';
import { Upload, Download, TrendingUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useRequireAuth();
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);

  // Fetch user orders only when user is loaded
  // Updated to use new query parameters format (Requirements 9.1, 9.2)
  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useUserOrders(user?.id || '', {
    page: 1,
    limit: 50,
    sort: 'created_at', // Using 'sort' instead of 'sort_by' (Requirement 9.2)
    order: 'desc', // Using 'order' instead of 'sort_order' (Requirement 9.2)
  });

  // Auto-refresh hooks para manter a lista atualizada
  const { forceRefresh } = useOrdersRefresh({
    userId: user?.id,
    interval: 30000, // 30 segundos
    enabled: !!user?.id,
  });

  // Monitor específico para pagamentos pendentes
  usePendingPaymentsMonitor(user?.id, !!user?.id);

  // Download file mutation
  const downloadFile = useDownloadFile();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleDownload = async (orderId: string) => {
    try {
      await downloadFile.mutateAsync(orderId);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handlePayment = async (orderId: string) => {
    console.log('🔄 Iniciando pagamento para order:', orderId);
    console.log(
      '🔑 Token atual:',
      apiClient.currentAccessToken ? 'Presente' : 'Ausente'
    );
    console.log('👤 Usuário atual:', user);

    setIsPaymentLoading(true);

    try {
      // Updated to use new payment endpoint (Requirement 4.1)
      console.log('🔍 Verificando conectividade com a API...');

      const paymentResponse = await apiClient.initiatePayment(orderId);
      console.log('📡 Resposta completa da API de pagamento:', paymentResponse);

      if (paymentResponse.success) {
        // Updated to handle new payment response format (Requirement 4.3)
        if (paymentResponse.data?.checkout_url) {
          console.log(
            '✅ URL de pagamento encontrada:',
            paymentResponse.data.checkout_url
          );

          // Tentar abrir em nova aba
          const opened = window.open(
            paymentResponse.data.checkout_url,
            '_blank'
          );

          if (!opened || opened.closed || typeof opened.closed == 'undefined') {
            // Pop-up foi bloqueado
            const userWantsToOpen = confirm(
              `Pop-up foi bloqueado pelo navegador.\n\nURL de pagamento: ${paymentResponse.data.checkout_url}\n\nDeseja copiar a URL para a área de transferência?`
            );

            if (userWantsToOpen) {
              try {
                await navigator.clipboard.writeText(
                  paymentResponse.data.checkout_url
                );
                alert(
                  'URL copiada para a área de transferência! Cole em uma nova aba do navegador.'
                );
              } catch (clipboardError) {
                // Fallback se clipboard não funcionar
                prompt(
                  'Copie esta URL e cole em uma nova aba:',
                  paymentResponse.data.checkout_url
                );
              }
            }
          } else {
            console.log('✅ Nova aba aberta com sucesso');
          }
        } else {
          console.error(
            '❌ Resposta de sucesso mas sem checkout_url:',
            paymentResponse
          );
          alert(
            `Erro: API retornou sucesso mas sem URL de pagamento.\n\nResposta: ${JSON.stringify(paymentResponse, null, 2)}`
          );
        }
      } else {
        console.error('❌ API retornou erro:', paymentResponse);
        // Updated error handling for new response format (Requirement 6.3)
        const errorResponse = paymentResponse as any; // Cast to handle error properties
        const errorMsg =
          paymentResponse.message || errorResponse.error || 'Erro desconhecido';

        // Verificar se é erro de autenticação
        if (
          errorResponse.error === 'UNAUTHORIZED' ||
          errorMsg.includes('credentials')
        ) {
          alert(
            `Erro de autenticação: ${errorMsg}\n\nTente fazer login novamente.`
          );
          // Opcional: redirecionar para login
          // logout();
        } else {
          alert(
            `Erro da API: ${errorMsg}\n\nDetalhes: ${JSON.stringify(paymentResponse, null, 2)}`
          );
        }
      }
    } catch (error: any) {
      console.error('💥 Erro na chamada da API:', error);

      let errorMessage = 'Erro desconhecido';
      if (error.message) {
        errorMessage = error.message;
      }

      // Verificar se é erro de rede
      if (
        error.message?.includes('fetch') ||
        error.message?.includes('Network')
      ) {
        errorMessage =
          'Erro de conexão: Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
      }

      alert(
        `Erro de conexão: ${errorMessage}\n\nVerifique:\n- Se o backend está rodando na porta 8000\n- Se não há problemas de CORS\n- Se você está autenticado corretamente`
      );
    } finally {
      setIsPaymentLoading(false);
    }
  };

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}!</p>
        </div>

        {/* Statistics Cards */}
        {ordersData && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Total Orders
                  </span>
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {ordersData.total}
                </div>
                <p className="text-xs text-gray-500 mt-1">All time</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Pending Payment
                  </span>
                  <Upload className="w-4 h-4 text-yellow-500" />
                </div>
                <div className="text-3xl font-bold text-yellow-600">
                  {
                    ordersData.orders.filter(
                      (order: any) => order.status === 'pending_payment'
                    ).length
                  }
                </div>
                <p className="text-xs text-gray-500 mt-1">Awaiting payment</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Processing
                  </span>
                  <Upload className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {
                    ordersData.orders.filter(
                      (order: any) =>
                        order.status === 'processing' || order.status === 'paid'
                    ).length
                  }
                </div>
                <p className="text-xs text-gray-500 mt-1">In progress</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    Completed
                  </span>
                  <Download className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-green-600">
                  {
                    ordersData.orders.filter(
                      (order: any) => order.status === 'completed'
                    ).length
                  }
                </div>
                <p className="text-xs text-gray-500 mt-1">Ready for download</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Action */}
        <div className="mb-8 flex gap-4 items-center">
          <Link href="/upload">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Upload className="w-4 h-4" />
              Upload New File
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={() => {
              forceRefresh();
              refetchOrders();
            }}
            disabled={ordersLoading}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`}
            />
            Atualizar Lista
          </Button>

          {/* Debug buttons - remove in production */}
          <Link href="/test-api-connection">
            <Button variant="outline" size="sm">
              🔧 Test API
            </Button>
          </Link>
          <Link href="/debug-payment">
            <Button variant="outline" size="sm">
              🔧 Debug Payment
            </Button>
          </Link>
        </div>

        {/* Order History */}
        <div>
          {ordersError ? (
            <Card className="border-0 shadow-md">
              <CardContent className="p-8">
                <div className="text-center">
                  <p className="text-red-600 mb-4">
                    Failed to load order history. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <OrderHistoryTable
              orders={ordersData?.orders || []}
              onDownload={handleDownload}
              onPayment={handlePayment}
              isLoading={ordersLoading || isPaymentLoading}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
