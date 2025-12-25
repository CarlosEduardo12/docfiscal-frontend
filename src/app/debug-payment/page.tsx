'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuthNew';
import { useUserOrders } from '@/lib/react-query';

export default function DebugPaymentPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  
  const { data: ordersData } = useUserOrders(user?.id || '', {
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testPaymentAPI = async (orderId: string) => {
    addLog(`🔄 Iniciando teste de pagamento para order: ${orderId}`);
    
    try {
      // Verificar se o usuário está autenticado
      addLog(`👤 Usuário autenticado: ${apiClient.isAuthenticated ? 'Sim' : 'Não'}`);
      addLog(`🔑 Token presente: ${apiClient.currentAccessToken ? 'Sim' : 'Não'}`);
      
      // Fazer a chamada da API
      const response = await apiClient.initiatePayment(orderId);
      addLog(`📡 Resposta recebida: ${JSON.stringify(response, null, 2)}`);
      
      if (response.success) {
        if (response.data?.payment_url) {
          addLog(`✅ URL de pagamento encontrada: ${response.data.payment_url}`);
          
          // Tentar abrir a URL
          const opened = window.open(response.data.payment_url, '_blank');
          if (opened) {
            addLog('✅ Nova aba aberta com sucesso');
          } else {
            addLog('❌ Falha ao abrir nova aba (pop-up bloqueado?)');
          }
        } else {
          addLog('❌ Resposta de sucesso mas sem payment_url');
        }
      } else {
        addLog(`❌ API retornou erro: ${response.message || 'Sem mensagem'}`);
      }
      
    } catch (error: any) {
      addLog(`💥 Erro na chamada da API: ${error.message}`);
      addLog(`📋 Stack trace: ${error.stack || 'Não disponível'}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Você precisa estar logado para debugar pagamentos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingOrders = ordersData?.orders?.filter(order => order.status === 'pending_payment') || [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Debug de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Usuário:</strong> {user.name} ({user.email})
              </div>
              <div>
                <strong>Autenticado:</strong> {apiClient.isAuthenticated ? 'Sim' : 'Não'}
              </div>
              <div>
                <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL}
              </div>
              <div>
                <strong>Return URL:</strong> {process.env.NEXT_PUBLIC_PAYMENT_RETURN_URL}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders com Pagamento Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-gray-500">Nenhum pedido com pagamento pendente encontrado.</p>
            ) : (
              <div className="space-y-2">
                {pendingOrders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{order.original_filename || 'Arquivo'}</div>
                      <div className="text-sm text-gray-500">ID: {order.id}</div>
                    </div>
                    <Button 
                      onClick={() => testPaymentAPI(order.id)}
                      size="sm"
                    >
                      Testar Pagamento
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Logs de Debug</CardTitle>
            <Button onClick={clearLogs} variant="outline" size="sm">
              Limpar Logs
            </Button>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">Nenhum log ainda...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}