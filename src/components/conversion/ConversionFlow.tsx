'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload,
  FileText,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/react-query';

type ConversionStep =
  | 'upload'
  | 'payment'
  | 'waiting'
  | 'processing'
  | 'completed'
  | 'error';

interface ConversionState {
  currentStep: ConversionStep;
  status: string;
  loading: boolean;
  progress: number;
  paymentStatus: string;
  file: File | null;
  orderId: string | null;
  paymentId: string | null;
  paymentUrl: string | null;
  error: string | null;
  downloadUrl: string | null;
  timeRemaining: number;
}

export function ConversionFlow() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [state, setState] = useState<ConversionState>({
    currentStep: 'upload',
    status: 'Selecione um arquivo PDF',
    loading: false,
    progress: 0,
    paymentStatus: '',
    file: null,
    orderId: null,
    paymentId: null,
    paymentUrl: null,
    error: null,
    downloadUrl: null,
    timeRemaining: 600, // 10 minutes
  });

  const updateState = (updates: Partial<ConversionState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  // 1. Upload do PDF
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      updateState({
        file,
        status: `Arquivo selecionado: ${file.name}`,
        error: null,
      });
    } else {
      updateState({
        error: 'Por favor, selecione um arquivo PDF válido',
        status: 'Erro na seleção do arquivo',
      });
    }
  };

  const uploadPDF = async () => {
    if (!state.file) return;

    updateState({ loading: true, status: 'Enviando arquivo...' });

    try {
      // Updated to use new upload endpoint format (Requirement 2.1)
      const response = await apiClient.uploadFile(state.file);

      if (response.success) {
        // Updated to handle new upload response format (Requirement 2.4)
        updateState({
          orderId: response.data.order_id,
          status: 'Arquivo enviado! Iniciando pagamento...',
          currentStep: 'payment',
          loading: false,
        });

        // Invalidar cache para mostrar o novo pedido
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

        // Ir para próximo passo
        setTimeout(() => createPayment(response.data.order_id), 1000);
      }
    } catch (error) {
      handleError(error, 'upload');
    }
  };

  // 2. Iniciar Pagamento
  const createPayment = async (orderId: string) => {
    updateState({ loading: true, status: 'Criando pagamento...' });

    try {
      // Garantir que estamos usando a URL correta
      const baseUrl = window.location.origin;
      const returnUrl =
        process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL ||
        `${baseUrl}/payment/complete`;
      const cancelUrl =
        process.env.NEXT_PUBLIC_PAYMENT_CANCEL_URL ||
        `${baseUrl}/payment/success`;

      console.log('🔗 URLs de retorno configuradas:');
      console.log('  Return URL:', returnUrl);
      console.log('  Cancel URL:', cancelUrl);
      console.log('  Base URL:', baseUrl);

      // Updated to use new payment endpoint (already implemented in API client)
      const response = await apiClient.initiatePayment(orderId, {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      });

      if (response.success) {
        console.log('✅ Pagamento criado com sucesso:', response.data);

        // Updated to handle new payment response format with checkout_url (Requirement 4.3)
        updateState({
          paymentId: response.data.payment_id,
          paymentUrl: response.data.checkout_url || response.data.payment_url, // Support both formats
          status: 'Pagamento criado! Redirecionando...',
          currentStep: 'waiting',
          loading: false,
        });

        // Redirecionar para AbacatePay
        const paymentUrl =
          response.data.checkout_url || response.data.payment_url;
        console.log('🔗 Abrindo URL de pagamento:', paymentUrl);
        window.open(paymentUrl, '_blank');

        // Iniciar monitoramento
        startPaymentMonitoring(response.data.payment_id);
      }
    } catch (error) {
      console.error('❌ Erro ao criar pagamento:', error);
      handleError(error, 'payment');
    }
  };

  // 3. Monitoramento do Pagamento
  const startPaymentMonitoring = (paymentId: string) => {
    updateState({
      status: 'Aguardando pagamento...',
      paymentStatus: 'Aguardando pagamento...',
    });

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        timeRemaining: Math.max(0, prev.timeRemaining - 1),
      }));
    }, 1000);

    // Polling a cada 5 segundos
    const interval = setInterval(async () => {
      try {
        const response = await apiClient.getPaymentStatus(paymentId);

        switch (response.data.status) {
          case 'pending':
            updateState({ paymentStatus: 'Aguardando pagamento...' });
            break;

          case 'paid':
            updateState({ paymentStatus: '✅ Pagamento confirmado!' });
            // Invalidar cache quando pagamento confirmado
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            if (state.orderId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.orders.byId(state.orderId),
              });
            }
            clearInterval(interval);
            clearInterval(countdownInterval);
            startProcessingMonitoring();
            break;

          case 'expired':
            updateState({
              paymentStatus: '❌ Pagamento expirado',
              currentStep: 'error',
              error: 'Pagamento expirado. Tente novamente.',
            });
            clearInterval(interval);
            clearInterval(countdownInterval);
            break;

          case 'cancelled':
            updateState({
              paymentStatus: '❌ Pagamento cancelado',
              currentStep: 'error',
              error: 'Pagamento cancelado.',
            });
            clearInterval(interval);
            clearInterval(countdownInterval);
            break;
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
      }
    }, 5000);

    // Limpar após 10 minutos
    setTimeout(() => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    }, 600000);
  };

  // 4. Processamento do Arquivo
  const startProcessingMonitoring = () => {
    updateState({
      status: 'Processando arquivo...',
      currentStep: 'processing',
      progress: 0,
    });

    // Simular progresso visual
    const progressInterval = setInterval(() => {
      setState((prev) => ({
        ...prev,
        progress: Math.min(prev.progress + 10, 90),
      }));
    }, 500);

    // Verificar status do pedido
    const statusInterval = setInterval(async () => {
      try {
        const response = await apiClient.getOrder(state.orderId!);

        if (response.data.status === 'completed') {
          clearInterval(progressInterval);
          clearInterval(statusInterval);
          // Invalidar cache quando processamento completo
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders.byId(state.orderId!),
          });

          updateState({
            progress: 100,
            currentStep: 'completed',
            status: '✅ Conversão concluída!',
            downloadUrl: `/api/orders/${state.orderId}/download`,
          });

          // Auto-download
          setTimeout(() => downloadFile(), 1000);
        } else if (response.data.status === 'failed') {
          clearInterval(progressInterval);
          clearInterval(statusInterval);
          // Invalidar cache mesmo em caso de falha
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          handleError(
            new Error(response.data.error || 'Erro no processamento'),
            'processing'
          );
        }
      } catch (error) {
        console.error('Erro ao verificar processamento:', error);
      }
    }, 3000);
  };

  // 5. Download do Resultado
  const downloadFile = async () => {
    if (!state.orderId) return;

    try {
      const { blob, filename } = await apiClient.downloadOrder(state.orderId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Use filename from Content-Disposition header if available, otherwise fallback
      link.download =
        filename || `${state.file?.name.replace('.pdf', '')}_converted.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Erro no download:', error);

      // Handle specific error types
      if (error.code === 'DOWNLOAD_LINK_EXPIRED') {
        // This will be handled by the retry functionality in subtask 8.2
        console.warn('Download link expired, retry functionality needed');
      }
    }
  };

  // 6. Tratamento de Erros
  const handleError = (error: any, step: string) => {
    const errorMessages = {
      upload: 'Erro no upload. Verifique o arquivo e tente novamente.',
      payment: 'Erro ao processar pagamento. Tente novamente.',
      processing: 'Erro na conversão. Entre em contato com o suporte.',
      network: 'Erro de conexão. Verifique sua internet.',
    };

    // Updated error handling for new response format (Requirements 6.1, 6.2)
    const errorMessage =
      errorMessages[step as keyof typeof errorMessages] || 'Erro inesperado';
    let detailedError = 'Erro desconhecido';

    if (error && typeof error === 'object') {
      // Handle new standardized error format
      if (error.message) {
        detailedError = error.message;
      } else if (error.error) {
        detailedError = error.error;
      }

      // Handle field-specific errors (Requirement 6.4)
      if (error.details && error.details.field_errors) {
        const fieldErrors = Object.entries(error.details.field_errors)
          .map(
            ([field, errors]) =>
              `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
          )
          .join('; ');
        detailedError = `${detailedError}. Detalhes: ${fieldErrors}`;
      }
    } else if (error instanceof Error) {
      detailedError = error.message;
    }

    updateState({
      currentStep: 'error',
      status: `❌ ${errorMessage}`,
      error: detailedError,
      loading: false,
    });
  };

  // 7. Reset para nova conversão
  const startNewConversion = () => {
    setState({
      currentStep: 'upload',
      status: 'Selecione um arquivo PDF',
      loading: false,
      progress: 0,
      paymentStatus: '',
      file: null,
      orderId: null,
      paymentId: null,
      paymentUrl: null,
      error: null,
      downloadUrl: null,
      timeRemaining: 600,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          {/* Step 1: Upload */}
          {state.currentStep === 'upload' && (
            <div className="text-center">
              <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Upload do PDF</h2>
              <p className="text-gray-600 mb-6">{state.status}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-4">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Selecionar Arquivo PDF
                </Button>

                {state.file && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium">{state.file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(state.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}

                <Button
                  onClick={uploadPDF}
                  disabled={!state.file || state.loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {state.loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Enviar PDF para Conversão
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {state.currentStep === 'payment' && (
            <div className="text-center">
              <CreditCard className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">
                Confirmação de Pagamento
              </h2>
              <p className="text-gray-600 mb-6">{state.status}</p>

              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h3 className="font-bold text-lg mb-4">Resumo do Pedido</h3>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span>Arquivo:</span>
                    <span className="font-medium">{state.file?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Serviço:</span>
                    <span className="font-medium">Conversão PDF → CSV</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Valor:</span>
                    <span className="text-green-600">R$ 50,00</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => createPayment(state.orderId!)}
                disabled={state.loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {state.loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                💳 Pagar com PIX - R$ 50,00
              </Button>
            </div>
          )}

          {/* Step 3: Waiting for Payment */}
          {state.currentStep === 'waiting' && (
            <div className="text-center">
              <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">Aguardando Pagamento</h2>
              <p className="text-gray-600 mb-6">
                Complete o pagamento na aba do AbacatePay
              </p>
              <p className="text-lg font-medium mb-6">{state.paymentStatus}</p>

              <div className="bg-blue-50 p-6 rounded-lg mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>💰 Valor:</span>
                    <span className="font-bold">R$ 50,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🔗 Método:</span>
                    <span className="font-bold">PIX</span>
                  </div>
                  <div className="flex justify-between">
                    <span>⏰ Tempo restante:</span>
                    <span className="font-bold text-red-600">
                      {formatTime(state.timeRemaining)}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => window.open(state.paymentUrl!, '_blank')}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                🔄 Reabrir Pagamento
              </Button>
            </div>
          )}

          {/* Step 4: Processing */}
          {state.currentStep === 'processing' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Processando seu arquivo...
              </h2>
              <p className="text-gray-600 mb-6">Convertendo PDF para CSV</p>

              <div className="bg-gray-200 rounded-full h-4 mb-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${state.progress}%` }}
                ></div>
              </div>

              <p className="text-sm text-gray-500">
                {state.progress}% - Isso pode levar alguns segundos...
              </p>
            </div>
          )}

          {/* Step 5: Completed */}
          {state.currentStep === 'completed' && (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Conversão Concluída!</h2>
              <p className="text-gray-600 mb-6">
                Seu arquivo CSV está pronto para download
              </p>

              <div className="bg-green-50 p-6 rounded-lg mb-6">
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span>📄 Arquivo original:</span>
                    <span className="font-medium">{state.file?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📊 Arquivo convertido:</span>
                    <span className="font-medium">
                      {state.file?.name.replace('.pdf', '_converted.csv')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>⏰ Status:</span>
                    <span className="font-medium text-green-600">
                      Concluído
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={downloadFile}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  📥 Baixar CSV
                </Button>

                <Button
                  onClick={startNewConversion}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  🔄 Nova Conversão
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Error */}
          {state.currentStep === 'error' && (
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h2>
              <p className="text-gray-600 mb-2">{state.status}</p>
              {state.error && (
                <p className="text-sm text-red-600 mb-6">{state.error}</p>
              )}

              <div className="space-y-3">
                <Button
                  onClick={startNewConversion}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open('mailto:suporte@docfiscal.com', '_blank')
                  }
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Contatar Suporte
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
