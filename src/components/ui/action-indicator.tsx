'use client';

import React from 'react';
import { 
  CreditCard, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Clock,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Badge } from './badge';
import type { OrderStatus } from '@/types';

export interface OrderAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
  primary?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
}

export interface ActionAvailabilityProps {
  status: OrderStatus;
  onPayment?: () => void;
  onDownload?: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  className?: string;
}

// Get available actions based on order status
export const getAvailableActions = (
  status: OrderStatus,
  handlers: {
    onPayment?: () => void;
    onDownload?: () => void;
    onRetry?: () => void;
  } = {}
): OrderAction[] => {
  const { onPayment, onDownload, onRetry } = handlers;

  const actionConfigs: Record<OrderStatus, OrderAction[]> = {
    'pending_payment': [
      {
        id: 'payment',
        label: 'Efetuar Pagamento',
        description: 'Complete o pagamento para iniciar o processamento',
        icon: CreditCard,
        available: true,
        primary: true,
        disabled: !onPayment,
        disabledReason: !onPayment ? 'Função de pagamento não disponível' : undefined,
        onClick: onPayment
      },
      {
        id: 'cancel',
        label: 'Cancelar Pedido',
        description: 'Cancelar este pedido',
        icon: AlertCircle,
        available: true,
        primary: false,
        disabled: false
      }
    ],
    'paid': [
      {
        id: 'wait',
        label: 'Aguardar Processamento',
        description: 'O processamento iniciará automaticamente',
        icon: Clock,
        available: false,
        primary: false,
        disabled: true,
        disabledReason: 'Processamento será iniciado automaticamente'
      }
    ],
    'processing': [
      {
        id: 'wait',
        label: 'Processando...',
        description: 'Aguarde enquanto seu arquivo é convertido',
        icon: RefreshCw,
        available: false,
        primary: false,
        disabled: true,
        disabledReason: 'Processamento em andamento'
      },
      {
        id: 'refresh',
        label: 'Atualizar Status',
        description: 'Verificar o progresso do processamento',
        icon: RefreshCw,
        available: true,
        primary: false,
        disabled: false
      }
    ],
    'completed': [
      {
        id: 'download',
        label: 'Baixar Arquivo',
        description: 'Baixar o arquivo CSV convertido',
        icon: Download,
        available: true,
        primary: true,
        disabled: !onDownload,
        disabledReason: !onDownload ? 'Função de download não disponível' : undefined,
        onClick: onDownload
      },
      {
        id: 'new_order',
        label: 'Novo Pedido',
        description: 'Fazer upload de outro arquivo',
        icon: RefreshCw,
        available: true,
        primary: false,
        disabled: false
      }
    ],
    'failed': [
      {
        id: 'retry',
        label: 'Tentar Novamente',
        description: 'Fazer novo upload do arquivo',
        icon: RefreshCw,
        available: true,
        primary: true,
        disabled: !onRetry,
        disabledReason: !onRetry ? 'Função de retry não disponível' : undefined,
        onClick: onRetry
      },
      {
        id: 'support',
        label: 'Contatar Suporte',
        description: 'Obter ajuda com este problema',
        icon: HelpCircle,
        available: true,
        primary: false,
        disabled: false
      }
    ]
  };

  return actionConfigs[status] || [];
};

export function ActionAvailabilityIndicator({
  status,
  onPayment,
  onDownload,
  onRetry,
  isLoading = false,
  className
}: ActionAvailabilityProps) {
  const actions = getAvailableActions(status, { onPayment, onDownload, onRetry });
  const availableActions = actions.filter(action => action.available);
  const unavailableActions = actions.filter(action => !action.available);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Available Actions */}
      {availableActions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">
            Ações Disponíveis
          </h4>
          <div className="flex flex-col sm:flex-row gap-2">
            {availableActions.map((action) => {
              const ActionIcon = action.icon;
              const isDisabled = action.disabled || isLoading;
              
              return (
                <div key={action.id} className="relative group">
                  <Button
                    variant={action.primary ? 'default' : 'outline'}
                    disabled={isDisabled}
                    onClick={action.onClick}
                    className="w-full sm:w-auto"
                    aria-describedby={`${action.id}-description`}
                  >
                    <ActionIcon className="h-4 w-4 mr-2" aria-hidden="true" />
                    {action.label}
                  </Button>
                  
                  {/* Tooltip for disabled actions */}
                  {isDisabled && action.disabledReason && (
                    <div 
                      id={`${action.id}-description`}
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap"
                      role="tooltip"
                    >
                      {action.disabledReason}
                    </div>
                  )}
                  
                  {/* Description tooltip for enabled actions */}
                  {!isDisabled && (
                    <div 
                      id={`${action.id}-description`}
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap"
                      role="tooltip"
                    >
                      {action.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unavailable Actions */}
      {unavailableActions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Ações Indisponíveis
          </h4>
          <div className="space-y-2">
            {unavailableActions.map((action) => {
              const ActionIcon = action.icon;
              
              return (
                <div 
                  key={action.id} 
                  className="flex items-center space-x-3 p-2 bg-muted rounded-md"
                >
                  <ActionIcon 
                    className="h-4 w-4 text-muted-foreground" 
                    aria-hidden="true" 
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {action.label}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Indisponível
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.disabledReason || action.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No actions available */}
      {actions.length === 0 && (
        <div className="text-center py-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhuma ação disponível para este status
          </p>
        </div>
      )}
    </div>
  );
}

// Compact action indicator for tables and cards
export function CompactActionIndicator({
  status,
  className
}: {
  status: OrderStatus;
  className?: string;
}) {
  const actions = getAvailableActions(status);
  const availableCount = actions.filter(action => action.available).length;
  const totalCount = actions.length;

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending_payment':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'paid':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={cn('inline-flex items-center space-x-2', className)}>
      <Badge 
        variant="outline" 
        className={cn('text-xs', getStatusColor(status))}
      >
        {availableCount} de {totalCount} ações
      </Badge>
      
      {availableCount > 0 && (
        <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
      )}
      
      {availableCount === 0 && totalCount > 0 && (
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}