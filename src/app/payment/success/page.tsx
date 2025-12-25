'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = useState<string>('checking');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verificando status do pagamento...');

  const paymentId = searchParams.get('payment_id');
  const orderId = searchParams.get('order_id');

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId && !orderId) {
      setPaymentStatus('error');
      setMessage('Informações de pagamento não encontradas.');
      setLoading(false);
      return;
    }

    try {
      // Se temos payment_id, verificar status do pagamento
      if (paymentId) {
        const response = await apiClient.getPaymentStatus(paymentId);
        
        if (response.success) {
          const status = response.data.status;
          
          if (status === 'paid') {
            // Pagamento confirmado, invalidar cache e redirecionar
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            if (orderId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.byId(orderId) });
            }
            
            setPaymentStatus('paid');
            setMessage('Pagamento confirmado! Redirecionando...');
            setTimeout(() => {
              router.push(`/payment/complete?payment_id=${paymentId}&order_id=${orderId || response.data.order_id}`);
            }, 2000);
          } else if (status === 'pending') {
            setPaymentStatus('pending');
            setMessage('Pagamento ainda pendente. Verificando novamente...');
            // Continuar verificando
            setTimeout(checkPaymentStatus, 3000);
          } else if (status === 'cancelled' || status === 'expired') {
            setPaymentStatus('cancelled');
            setMessage('Pagamento cancelado ou expirado.');
          } else {
            setPaymentStatus('unknown');
            setMessage(`Status do pagamento: ${status}`);
          }
        }
      } else if (orderId) {
        // Se só temos order_id, verificar status do pedido
        const response = await apiClient.getOrder(orderId);
        
        if (response.success) {
          const orderStatus = response.data.status;
          
          if (orderStatus === 'completed' || orderStatus === 'processing') {
            // Pedido já está sendo processado ou completo
            router.push(`/payment/complete?order_id=${orderId}`);
          } else if (orderStatus === 'pending_payment') {
            setPaymentStatus('pending');
            setMessage('Aguardando confirmação do pagamento...');
            setTimeout(checkPaymentStatus, 3000);
          } else {
            setPaymentStatus('unknown');
            setMessage(`Status do pedido: ${orderStatus}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      setPaymentStatus('error');
      setMessage('Erro ao verificar status do pagamento.');
    } finally {
      setLoading(false);
    }
  }, [paymentId, orderId, router]);

  useEffect(() => {
    checkPaymentStatus();
  }, [checkPaymentStatus]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {(paymentStatus === 'checking' || paymentStatus === 'pending') && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl text-blue-600">
                Retornando do pagamento...
              </CardTitle>
            </>
          )}

          {paymentStatus === 'paid' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl text-green-600">
                Pagamento Confirmado!
              </CardTitle>
            </>
          )}

          {(paymentStatus === 'cancelled' || paymentStatus === 'error') && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl text-yellow-600">
                Atenção
              </CardTitle>
            </>
          )}

          {paymentStatus === 'unknown' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-gray-600" />
              </div>
              <CardTitle className="text-2xl text-gray-600">
                Verificando...
              </CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p>{message}</p>
            {(paymentStatus === 'checking' || paymentStatus === 'pending') && (
              <p className="text-sm mt-2">Isso pode levar alguns segundos.</p>
            )}
          </div>

          {loading && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && (paymentStatus === 'cancelled' || paymentStatus === 'error' || paymentStatus === 'unknown') && (
            <div className="space-y-2">
              <Button
                onClick={() => router.push('/')}
                className="w-full"
                size="lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>
          )}

          {(paymentId || orderId) && (
            <div className="text-xs text-gray-500 text-center space-y-1">
              {paymentId && <div>ID do Pagamento: {paymentId}</div>}
              {orderId && <div>ID do Pedido: {orderId}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
