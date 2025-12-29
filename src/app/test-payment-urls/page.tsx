'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuthNew';

export default function TestPaymentURLsPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>('');

  useEffect(() => {
    // Set base URL only on client side
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const testPaymentCreation = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Primeiro, fazer um upload de teste
      console.log('📤 Criando upload de teste...');

      // Criar um arquivo de teste
      const testFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const uploadResponse = await apiClient.uploadFile(testFile);

      if (!uploadResponse.success) {
        throw new Error('Falha no upload: ' + uploadResponse.message);
      }

      const orderId = uploadResponse.data.order_id;
      console.log('✅ Upload criado, Order ID:', orderId);

      // Agora testar a criação do pagamento
      const returnUrl =
        process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL ||
        `${baseUrl}/payment/complete`;
      const cancelUrl =
        process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL ||
        `${baseUrl}/payment/success`;

      console.log('🔗 Testando URLs:');
      console.log('  Return URL:', returnUrl);
      console.log('  Cancel URL:', cancelUrl);
      console.log('  Base URL:', baseUrl);

      const paymentResponse = await apiClient.initiatePayment(orderId, {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      });

      setResult({
        success: true,
        uploadResponse,
        paymentResponse,
        urls: {
          baseUrl,
          returnUrl,
          cancelUrl,
        },
        environment: {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
          NEXT_PUBLIC_PAYMENT_RETURN_URL:
            process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL,
          NEXT_PUBLIC_PAYMENT_CANCEL_URL:
            process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL,
        },
      });
    } catch (error: any) {
      console.error('❌ Erro no teste:', error);
      setResult({
        success: false,
        error: error.message,
        details: error,
      });
    } finally {
      setLoading(false);
    }
  };

  const openPaymentUrl = () => {
    if (
      result?.paymentResponse?.data?.payment_url &&
      typeof window !== 'undefined'
    ) {
      window.open(result.paymentResponse.data.payment_url, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>🧪 Teste de URLs de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informações do usuário */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">👤 Usuário Atual</h3>
              {user ? (
                <div className="text-sm space-y-1">
                  <div>
                    <strong>Nome:</strong> {user.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {user.email}
                  </div>
                  <div>
                    <strong>ID:</strong> {user.id}
                  </div>
                </div>
              ) : (
                <div className="text-red-600">❌ Usuário não autenticado</div>
              )}
            </div>

            {/* URLs configuradas */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">🔗 URLs Configuradas</h3>
              <div className="text-sm space-y-1">
                <div>
                  <strong>Base URL:</strong> {baseUrl || 'Loading...'}
                </div>
                <div>
                  <strong>Return URL:</strong>{' '}
                  {process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL ||
                    `${baseUrl}/payment/complete`}
                </div>
                <div>
                  <strong>Cancel URL:</strong>{' '}
                  {process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL ||
                    `${baseUrl}/payment/success`}
                </div>
                <div>
                  <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL}
                </div>
              </div>
            </div>

            {/* Botão de teste */}
            <Button
              onClick={testPaymentCreation}
              disabled={loading || !user}
              className="w-full"
              size="lg"
            >
              {loading ? '🔄 Testando...' : '🧪 Testar Criação de Pagamento'}
            </Button>

            {/* Resultado */}
            {result && (
              <div className="space-y-4">
                {result.success ? (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-2">
                      ✅ Teste Bem-sucedido!
                    </h3>

                    <div className="space-y-3 text-sm">
                      <div>
                        <strong>Order ID:</strong>{' '}
                        {result.uploadResponse.data.order_id}
                      </div>

                      <div>
                        <strong>Payment ID:</strong>{' '}
                        {result.paymentResponse.data.payment_id}
                      </div>

                      <div>
                        <strong>Payment URL:</strong>
                        <div className="bg-white p-2 rounded mt-1 break-all">
                          {result.paymentResponse.data.payment_url}
                        </div>
                      </div>

                      <div>
                        <strong>URLs Enviadas para o Backend:</strong>
                        <div className="bg-white p-2 rounded mt-1">
                          <div>Return: {result.urls.returnUrl}</div>
                          <div>Cancel: {result.urls.cancelUrl}</div>
                        </div>
                      </div>

                      <Button
                        onClick={openPaymentUrl}
                        className="w-full mt-4"
                        variant="outline"
                      >
                        🔗 Abrir URL de Pagamento (Teste)
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-red-800 mb-2">
                      ❌ Erro no Teste
                    </h3>
                    <div className="text-sm text-red-700">
                      <div>
                        <strong>Erro:</strong> {result.error}
                      </div>
                      <pre className="bg-white p-2 rounded mt-2 text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instruções */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">
                📋 Como Testar
              </h3>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Certifique-se de estar logado</li>
                <li>Clique em &quot;Testar Criação de Pagamento&quot;</li>
                <li>Verifique se as URLs estão corretas</li>
                <li>
                  Clique em &quot;Abrir URL de Pagamento&quot; para testar
                </li>
                <li>Complete ou cancele o pagamento no AbacatePay</li>
                <li>Verifique se volta para a aplicação correta</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
