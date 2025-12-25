'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, ArrowLeft, RefreshCw, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState('checking');
  const [progress, setProgress] = useState(0);

  const paymentId = searchParams.get('payment_id');
  const orderId = searchParams.get('order_id');

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId) return;

    try {
      const response = await apiClient.getPaymentStatus(paymentId);
      
      if (response.success) {
        const status = response.data.status;
        
        if (status === 'paid') {
          setProcessingStatus('processing');
          startProcessingMonitoring();
        } else if (status === 'pending') {
          setProcessingStatus('waiting');
          // Continue checking
          setTimeout(checkPaymentStatus, 3000);
        } else {
          setProcessingStatus('failed');
        }
      }
    } catch (error) {
      console.error('Failed to check payment status:', error);
      setProcessingStatus('failed');
    }
  }, [paymentId]);

  const startProcessingMonitoring = useCallback(() => {
    if (!orderId) return;

    setProcessingStatus('processing');
    
    // Simular progresso visual
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    // Verificar status do pedido
    const statusInterval = setInterval(async () => {
      try {
        const response = await apiClient.getOrder(orderId);
        
        if (response.success) {
          const orderData = response.data;
          setOrder(orderData);
          
          // Invalidar cache sempre que o status do pedido mudar
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.byId(orderId) });
          
          if (orderData.status === 'completed') {
            clearInterval(progressInterval);
            clearInterval(statusInterval);
            setProgress(100);
            setProcessingStatus('completed');
            
            // Auto-download após 2 segundos
            setTimeout(() => handleDownload(orderData), 2000);
          } else if (orderData.status === 'failed') {
            clearInterval(progressInterval);
            clearInterval(statusInterval);
            setProcessingStatus('failed');
          }
        }
      } catch (error) {
        console.error('Failed to check order status:', error);
      }
    }, 3000);

    // Limpar após 10 minutos
    setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(statusInterval);
    }, 600000);
  }, [orderId]);

  const handleDownload = async (orderData?: any) => {
    const targetOrder = orderData || order;
    if (!orderId || !targetOrder) return;

    try {
      const blob = await apiClient.downloadOrder(orderId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetOrder.original_filename?.replace('.pdf', '') || 'converted'}_converted.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  useEffect(() => {
    if (paymentId || orderId) {
      setLoading(false);
      checkPaymentStatus();
    }
  }, [paymentId, orderId, checkPaymentStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {processingStatus === 'checking' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl text-blue-600">
                Verificando Pagamento...
              </CardTitle>
            </>
          )}
          
          {processingStatus === 'waiting' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-8 h-8 text-yellow-600 animate-pulse" />
              </div>
              <CardTitle className="text-2xl text-yellow-600">
                Aguardando Pagamento...
              </CardTitle>
            </>
          )}

          {processingStatus === 'processing' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl text-blue-600">
                ✅ Pagamento Concluído!
              </CardTitle>
            </>
          )}

          {processingStatus === 'completed' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-600">
                Conversão Concluída!
              </CardTitle>
            </>
          )}

          {processingStatus === 'failed' && (
            <>
              <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">
                Erro no Processamento
              </CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {processingStatus === 'checking' && (
            <div className="text-center text-gray-600">
              <p>Verificando o status do seu pagamento...</p>
              <p className="text-sm mt-2">Isso pode levar alguns segundos.</p>
            </div>
          )}

          {processingStatus === 'waiting' && (
            <div className="text-center text-gray-600">
              <p>Aguardando confirmação do pagamento...</p>
              <p className="text-sm mt-2">Complete o pagamento na aba do AbacatePay.</p>
            </div>
          )}

          {processingStatus === 'processing' && (
            <div className="space-y-4">
              <div className="text-center text-gray-600">
                <p className="font-medium">Processando seu arquivo...</p>
                <p className="text-sm mt-1">Convertendo PDF para CSV</p>
              </div>
              
              <div className="bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              
              <p className="text-center text-sm text-gray-500">
                {progress}% - Isso pode levar alguns segundos...
              </p>
            </div>
          )}

          {processingStatus === 'completed' && (
            <div className="space-y-4">
              <div className="text-center text-gray-600">
                <p>Seu arquivo CSV está pronto para download!</p>
                {order && (
                  <p className="mt-2 font-medium text-sm">
                    📄 {order.original_filename}
                  </p>
                )}
              </div>

              <Button onClick={() => handleDownload()} className="w-full" size="lg">
                <Download className="w-4 h-4 mr-2" />
                📥 Baixar CSV Convertido
              </Button>
            </div>
          )}

          {processingStatus === 'failed' && (
            <div className="text-center text-gray-600">
              <p>Houve um problema com o processamento.</p>
              <p className="text-sm mt-2">Tente novamente ou entre em contato com o suporte.</p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Início
            </Button>

            {processingStatus === 'failed' && (
              <Button
                onClick={() => router.push('/')}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Nova Conversão
              </Button>
            )}
          </div>

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

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PaymentCompleteContent />
    </Suspense>
  );
}