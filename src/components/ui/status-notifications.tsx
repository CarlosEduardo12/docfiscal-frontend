'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  CreditCard,
  Loader2,
  Bell,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Badge } from './badge';
import type { OrderStatus } from '@/types';

export interface StatusChangeNotification {
  id: string;
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  timestamp: Date;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  read: boolean;
  persistent?: boolean;
}

export interface StatusNotificationProps {
  notification: StatusChangeNotification;
  onDismiss?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  className?: string;
}

export interface StatusNotificationManagerProps {
  notifications: StatusChangeNotification[];
  onDismiss?: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
  maxVisible?: number;
  className?: string;
}

// Generate notification message based on status change
export const generateStatusChangeMessage = (
  previousStatus: OrderStatus,
  newStatus: OrderStatus,
  orderId: string
): { message: string; type: 'success' | 'warning' | 'error' | 'info' } => {
  const statusTransitions: Record<string, { message: string; type: 'success' | 'warning' | 'error' | 'info' }> = {
    'pending_payment->paid': {
      message: `Pagamento confirmado para o pedido ${orderId.slice(-8)}. Processamento iniciará em breve.`,
      type: 'success'
    },
    'paid->processing': {
      message: `Processamento iniciado para o pedido ${orderId.slice(-8)}. Seu arquivo está sendo convertido.`,
      type: 'info'
    },
    'processing->completed': {
      message: `Pedido ${orderId.slice(-8)} concluído com sucesso! Arquivo pronto para download.`,
      type: 'success'
    },
    'processing->failed': {
      message: `Erro no processamento do pedido ${orderId.slice(-8)}. Tente fazer upload novamente.`,
      type: 'error'
    },
    'pending_payment->failed': {
      message: `Pagamento não foi processado para o pedido ${orderId.slice(-8)}. Verifique os dados e tente novamente.`,
      type: 'error'
    },
    'paid->failed': {
      message: `Erro no processamento do pedido ${orderId.slice(-8)} após pagamento confirmado. Entre em contato com o suporte.`,
      type: 'error'
    }
  };

  const transitionKey = `${previousStatus}->${newStatus}`;
  return statusTransitions[transitionKey] || {
    message: `Status do pedido ${orderId.slice(-8)} alterado de ${previousStatus} para ${newStatus}.`,
    type: 'info'
  };
};

// Create notification for status change
export const createStatusChangeNotification = (
  orderId: string,
  previousStatus: OrderStatus,
  newStatus: OrderStatus
): StatusChangeNotification => {
  const { message, type } = generateStatusChangeMessage(previousStatus, newStatus, orderId);
  
  return {
    id: `${orderId}-${Date.now()}`,
    orderId,
    previousStatus,
    newStatus,
    timestamp: new Date(),
    message,
    type,
    read: false,
    persistent: type === 'error' || newStatus === 'completed'
  };
};

// Individual notification component
export function StatusNotification({
  notification,
  onDismiss,
  onMarkAsRead,
  className
}: StatusNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return Bell;
    }
  };

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss?.(notification.id);
    }, 300);
  };

  const handleMarkAsRead = () => {
    onMarkAsRead?.(notification.id);
  };

  useEffect(() => {
    if (!notification.read) {
      handleMarkAsRead();
    }
  }, [notification.read]);

  // Auto-dismiss non-persistent notifications after 5 seconds
  useEffect(() => {
    if (!notification.persistent) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.persistent]);

  if (!isVisible) return null;

  const NotificationIcon = getNotificationIcon(notification.type);

  return (
    <div
      className={cn(
        'flex items-start space-x-3 p-4 border rounded-lg shadow-sm transition-all duration-300',
        getNotificationStyles(notification.type),
        !notification.read && 'ring-2 ring-offset-2 ring-blue-500',
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <NotificationIcon 
        className="h-5 w-5 flex-shrink-0 mt-0.5" 
        aria-hidden="true" 
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Status Atualizado
            </p>
            <p className="text-sm mt-1">
              {notification.message}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {notification.previousStatus} → {notification.newStatus}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {notification.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-white/50"
            aria-label="Dispensar notificação"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Notification manager component
export function StatusNotificationManager({
  notifications,
  onDismiss,
  onMarkAsRead,
  onClearAll,
  maxVisible = 5,
  className
}: StatusNotificationManagerProps) {
  const visibleNotifications = notifications
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, maxVisible);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell className="h-4 w-4" aria-hidden="true" />
          <h3 className="text-sm font-medium">
            Notificações de Status
          </h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        {notifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs"
          >
            Limpar Todas
          </Button>
        )}
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        {visibleNotifications.map((notification) => (
          <StatusNotification
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>

      {/* Show more indicator */}
      {notifications.length > maxVisible && (
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            +{notifications.length - maxVisible} notificações adicionais
          </p>
        </div>
      )}
    </div>
  );
}

// Hook for managing status change notifications
export function useStatusNotifications() {
  const [notifications, setNotifications] = useState<StatusChangeNotification[]>([]);

  const addNotification = useCallback((
    orderId: string,
    previousStatus: OrderStatus,
    newStatus: OrderStatus
  ) => {
    const notification = createStatusChangeNotification(orderId, previousStatus, newStatus);
    setNotifications(prev => [notification, ...prev]);
    return notification.id;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return {
    notifications,
    addNotification,
    dismissNotification,
    markAsRead,
    clearAll,
    getUnreadCount
  };
}

// Immediate status change notification (toast-like)
export interface ImmediateNotificationProps {
  orderId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  onDismiss?: () => void;
  duration?: number;
}

export function ImmediateStatusNotification({
  orderId,
  previousStatus,
  newStatus,
  onDismiss,
  duration = 4000
}: ImmediateNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { message, type } = generateStatusChangeMessage(previousStatus, newStatus, orderId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertCircle;
      case 'info':
      default:
        return Clock;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-600 text-white';
      case 'info':
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const Icon = getIcon();

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center space-x-3 p-4 rounded-lg shadow-lg max-w-md',
        'transform transition-all duration-300 ease-in-out',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        getStyles()
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium">Status Atualizado</p>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(false)}
        className="h-6 w-6 p-0 text-white hover:bg-white/20"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}