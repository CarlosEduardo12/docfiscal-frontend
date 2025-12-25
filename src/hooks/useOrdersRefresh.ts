'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';

interface UseOrdersRefreshOptions {
  userId?: string;
  interval?: number; // em milissegundos
  enabled?: boolean;
}

export function useOrdersRefresh({
  userId,
  interval = 30000, // 30 segundos por padrão
  enabled = true,
}: UseOrdersRefreshOptions = {}) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshOrders = () => {
    if (!userId) return;

    // Invalidar todas as queries relacionadas a pedidos
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.orders.all 
    });
    
    // Invalidar especificamente os pedidos do usuário
    queryClient.invalidateQueries({ 
      queryKey: queryKeys.orders.byUser(userId) 
    });

    console.log('🔄 Lista de pedidos atualizada automaticamente');
  };

  const forceRefresh = () => {
    refreshOrders();
  };

  useEffect(() => {
    if (!enabled || !userId) return;

    // Configurar intervalo de atualização
    intervalRef.current = setInterval(refreshOrders, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, interval, enabled]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    forceRefresh,
  };
}

// Hook para detectar mudanças de status de pedidos específicos
export function useOrderStatusMonitor(orderId: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkOrderStatus = async () => {
    if (!orderId) return;

    try {
      // Invalidar o pedido específico para forçar refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.byId(orderId)
      });

      // Também invalidar a lista geral para manter consistência
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.all
      });
    } catch (error) {
      console.error('Erro ao verificar status do pedido:', error);
    }
  };

  useEffect(() => {
    if (!enabled || !orderId) return;

    // Verificar a cada 10 segundos para pedidos específicos
    intervalRef.current = setInterval(checkOrderStatus, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId, enabled]);

  return {
    checkOrderStatus,
  };
}

// Hook para monitorar pedidos com pagamento pendente
export function usePendingPaymentsMonitor(userId?: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkPendingPayments = async () => {
    if (!userId) return;

    try {
      // Buscar dados atuais do cache
      const ordersData = queryClient.getQueryData(
        queryKeys.orders.userOrders(userId)
      ) as any;

      if (ordersData?.orders) {
        const pendingOrders = ordersData.orders.filter(
          (order: any) => order.status === 'pending_payment' || order.status === 'processing'
        );

        if (pendingOrders.length > 0) {
          console.log(`🔍 Verificando ${pendingOrders.length} pedidos pendentes...`);
          
          // Invalidar queries para forçar refetch
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders.all
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar pagamentos pendentes:', error);
    }
  };

  useEffect(() => {
    if (!enabled || !userId) return;

    // Verificar a cada 15 segundos para pagamentos pendentes
    intervalRef.current = setInterval(checkPendingPayments, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, enabled]);

  return {
    checkPendingPayments,
  };
}