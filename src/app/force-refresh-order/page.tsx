'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

export default function ForceRefreshOrderPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkOrderStatus = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const response = await apiClient.getOrder(orderId);
      setResult({
        type: 'order',
        success: response.success,
        data: response.data,
        error: response.success ? null : response.message,
      });

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.byId(orderId),
      });
    } catch (error: any) {
      setResult({
        type: 'order',
        success: false,
        error: error.message,
        data: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentId) return;

    setLoading(true);
    try {
      const response = await apiClient.getPaymentStatus(paymentId);
      setResult({
        type: 'payment',
        success: response.success,
        data: response.data,
        error: response.success ? null : response.message,
      });
    } catch (error: any) {
      setResult({
        type: 'payment',
        success: false,
        error: error.message,
        data: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const forceRefreshAllOrders = async () => {
    setLoading(true);
    try {
      // Invalidar todas as queries de pedidos
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      // Buscar pedidos atualizados
      if (user?.id) {
        const response = await apiClient.getUserOrders(user.id, {
          page: 1,
          limit: 50,
          sort: 'created_at',
          order: 'desc',
        });

        setResult({
          type: 'all_orders',
          success: response.success,
          data: response.data,
          error: response.success ? null : response.message,
        });
      }
    } catch (error: any) {
      setResult({
        type: 'all_orders',
        success: false,
        error: error.message,
        data: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>🔄 Forçar Atualização de Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Verificar pedido específico */}
            <div className="space-y-4">
              <h3 className="font-semibold">📋 Verificar Pedido Específico</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Order ID (ex: 123e4567-e89b-12d3-a456-426614174000)"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={checkOrderStatus}
                  disabled={loading || !orderId}
                >
                  Verificar Pedido
                </Button>
              </div>
            </div>

            {/* Verificar pagamento específico */}
            <div className="space-y-4">
              <h3 className="font-semibold">
                💳 Verificar Pagamento Específico
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Payment ID"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={checkPaymentStatus}
                  disabled={loading || !paymentId}
                >
                  Verificar Pagamento
                </Button>
              </div>
            </div>

            {/* Atualizar todos os pedidos */}
            <div className="space-y-4">
              <h3 className="font-semibold">🔄 Atualizar Todos os Pedidos</h3>
              <Button
                onClick={forceRefreshAllOrders}
                disabled={loading || !user}
                className="w-full"
              >
                {loading
                  ? '🔄 Atualizando...'
                  : '🔄 Forçar Atualização Completa'}
              </Button>
            </div>

            {/* Resultado */}
            {result && (
              <div className="space-y-4">
                <h3 className="font-semibold">📊 Resultado</h3>
                {result.success ? (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">
                      ✅{' '}
                      {result.type === 'order'
                        ? 'Pedido'
                        : result.type === 'payment'
                          ? 'Pagamento'
                          : 'Pedidos'}{' '}
                      Atualizado
                    </h4>
                    <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">❌ Erro</h4>
                    <div className="text-sm text-red-700">
                      <div>
                        <strong>Erro:</strong> {result.error}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instruções */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Como Usar</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>
                  <strong>Para verificar um pedido específico:</strong> Cole o
                  Order ID e clique em &quot;Verificar Pedido&quot;
                </li>
                <li>
                  <strong>Para verificar um pagamento:</strong> Cole o Payment
                  ID e clique em &quot;Verificar Pagamento&quot;
                </li>
                <li>
                  <strong>Para atualizar tudo:</strong> Clique em &quot;Forçar
                  Atualização Completa&quot;
                </li>
                <li>
                  <strong>Encontrar IDs:</strong> Vá para o Dashboard ou console
                  do navegador
                </li>
              </ol>
            </div>

            {/* Links úteis */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">🔗 Links Úteis</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <a
                    href="/dashboard"
                    className="text-blue-600 hover:underline"
                  >
                    📊 Dashboard
                  </a>
                </div>
                <div>
                  <a
                    href="/test-payment-urls"
                    className="text-blue-600 hover:underline"
                  >
                    🧪 Teste de URLs
                  </a>
                </div>
                <div>
                  <a
                    href="/debug-payment"
                    className="text-blue-600 hover:underline"
                  >
                    🔧 Debug Payment
                  </a>
                </div>
                <div>
                  <a
                    href="/test-api-connection"
                    className="text-blue-600 hover:underline"
                  >
                    🔌 Teste API
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
