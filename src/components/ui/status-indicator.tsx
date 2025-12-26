'use client';

import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  CreditCard, 
  AlertCircle, 
  Loader2,
  XCircle,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import type { OrderStatus } from '@/types';

export interface StatusConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  iconColor: string;
  animated?: boolean;
}

export interface StatusIndicatorProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
  showIcon?: boolean;
  showBadge?: boolean;
  className?: string;
}

// Consistent status configuration mapping
export const getStatusConfig = (status: OrderStatus): StatusConfig => {
  const configs: Record<OrderStatus, StatusConfig> = {
    'pending_payment': {
      icon: CreditCard,
      label: 'Aguardando Pagamento',
      description: 'Clique em "Pagar" para continuar com o processamento',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      badgeVariant: 'outline',
      iconColor: 'text-yellow-600',
      animated: false
    },
    'paid': {
      icon: PlayCircle,
      label: 'Pagamento Confirmado',
      description: 'Pagamento recebido, processamento iniciará em breve',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badgeVariant: 'secondary',
      iconColor: 'text-blue-600',
      animated: false
    },
    'processing': {
      icon: Loader2,
      label: 'Processando',
      description: 'Seu documento está sendo convertido para CSV',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badgeVariant: 'secondary',
      iconColor: 'text-blue-600',
      animated: true
    },
    'completed': {
      icon: CheckCircle,
      label: 'Concluído',
      description: 'Arquivo CSV pronto para download',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      badgeVariant: 'default',
      iconColor: 'text-green-600',
      animated: false
    },
    'failed': {
      icon: AlertCircle,
      label: 'Erro no Processamento',
      description: 'Ocorreu um erro. Tente fazer upload novamente',
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      badgeVariant: 'destructive',
      iconColor: 'text-red-600',
      animated: false
    }
  };

  return configs[status] || configs['failed'];
};

export function StatusIndicator({
  status,
  size = 'md',
  showDescription = true,
  showIcon = true,
  showBadge = true,
  className
}: StatusIndicatorProps) {
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  const sizeClasses = {
    sm: {
      icon: 'h-4 w-4',
      text: 'text-sm',
      badge: 'text-xs'
    },
    md: {
      icon: 'h-5 w-5',
      text: 'text-base',
      badge: 'text-sm'
    },
    lg: {
      icon: 'h-6 w-6',
      text: 'text-lg',
      badge: 'text-base'
    }
  };

  return (
    <div 
      className={cn('flex items-start space-x-3', className)}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {showIcon && (
        <div className="flex-shrink-0">
          <StatusIcon
            className={cn(
              sizeClasses[size].icon,
              config.iconColor,
              config.animated && 'animate-spin'
            )}
            aria-hidden="true"
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className={cn('font-medium', config.color, sizeClasses[size].text)}>
            {config.label}
          </h3>
          
          {showBadge && (
            <Badge 
              variant={config.badgeVariant}
              className={sizeClasses[size].badge}
            >
              {status.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
        </div>
        
        {showDescription && (
          <p className={cn('mt-1 text-muted-foreground', sizeClasses[size].text)}>
            {config.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Compact status indicator for tables and lists
export function CompactStatusIndicator({ 
  status, 
  className 
}: { 
  status: OrderStatus; 
  className?: string; 
}) {
  const config = getStatusConfig(status);
  const StatusIcon = config.icon;

  return (
    <div 
      className={cn('inline-flex items-center space-x-2', className)}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <StatusIcon
        className={cn(
          'h-4 w-4',
          config.iconColor,
          config.animated && 'animate-spin'
        )}
        aria-hidden="true"
      />
      <Badge variant={config.badgeVariant} className="text-xs">
        {config.label}
      </Badge>
    </div>
  );
}

// Status progress indicator for multi-step processes
export interface StatusProgressProps {
  currentStatus: OrderStatus;
  className?: string;
}

export function StatusProgress({ currentStatus, className }: StatusProgressProps) {
  const allStatuses: OrderStatus[] = ['pending_payment', 'paid', 'processing', 'completed'];
  const currentIndex = allStatuses.indexOf(currentStatus);
  
  // Handle failed status separately
  if (currentStatus === 'failed') {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        <div className="flex items-center space-x-1">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-700">Processamento Falhou</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {allStatuses.map((status, index) => {
        const config = getStatusConfig(status);
        const StatusIcon = config.icon;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <React.Fragment key={status}>
            <div 
              className={cn(
                'flex items-center space-x-1',
                isCompleted && 'text-green-600',
                isCurrent && config.iconColor,
                isPending && 'text-gray-400'
              )}
            >
              <StatusIcon
                className={cn(
                  'h-4 w-4',
                  isCurrent && config.animated && 'animate-spin'
                )}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">
                {config.label}
              </span>
            </div>
            
            {index < allStatuses.length - 1 && (
              <div 
                className={cn(
                  'h-px w-8 bg-gray-300',
                  isCompleted && 'bg-green-300'
                )}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}