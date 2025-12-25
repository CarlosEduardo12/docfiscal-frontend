'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuthNew';

export default function TestPaymentPage() {
  const { user } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testPayment = async () => {
    if (!orderId.trim()) {
      setError('Por favor, insira um Order ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      console.log('🔄 Testando pagamento para order:', orderId);
      const paymentResponse = await apiClient.initiatePayment(orderId);
      console.log('📡 Resposta da API:', paymentResponse);
      
      setResponse(paymentResponse);
      
      if (paymentResponse.success && paymentResponse.data?.payment_url) {
        console.log('✅ URL de pagamento encontrada:', paymentResponse.data.payment_url);
        // Tentar abrir em nova aba
        const opened = window.open(paymentResponse.data.payment_url, '_blank');
        if (!opened) {
          setError('Pop-up bloqueado. Verifique as configurações do navegador.');
        }
      } else {
        setError(`Falha ao iniciar pagamento: ${paymentResponse.message || 'Resposta inválida'}`);
      }
    } catch (err: any) {
      console.error('💥 Erro no pagamento:', err);
      setError(`Erro: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Você precisa estar logado para testar pagamentos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Order ID para testar:
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Digite o ID do pedido"
              />
            </div>

            <Button 
              onClick={testPayment} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Testando...' : 'Testar Pagamento'}
            </Button>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {response && (
              <div className="p-4 bg-gray-50 border rounded">
                <h3 className="font-semibold mb-2">Resposta da API:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            )}

            <div className="text-sm text-gray-600">
              <p><strong>Usuário logado:</strong> {user.name} ({user.email})</p>
              <p><strong>Token presente:</strong> {apiClient.isAuthenticated ? 'Sim' : 'Não'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}