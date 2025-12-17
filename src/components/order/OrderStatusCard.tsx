'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import type { OrderStatusCardProps, OrderStatus } from '@/types';

const getStatusConfig = (status: OrderStatus) => {
  switch (status) {
    case 'pending_payment':
      return {
        icon: CreditCard,
        label: 'Pending Payment',
        description: 'Complete payment to start processing',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        variant: 'outline' as const,
      };
    case 'paid':
      return {
        icon: Clock,
        label: 'Payment Confirmed',
        description: 'Payment received, processing will begin shortly',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        variant: 'secondary' as const,
      };
    case 'processing':
      return {
        icon: Loader2,
        label: 'Processing',
        description: 'Your document is being converted',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        variant: 'secondary' as const,
      };
    case 'completed':
      return {
        icon: CheckCircle,
        label: 'Completed',
        description: 'Your CSV file is ready for download',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        variant: 'default' as const,
      };
    case 'failed':
      return {
        icon: AlertCircle,
        label: 'Failed',
        description: 'Processing failed, please try again',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        variant: 'destructive' as const,
      };
    default:
      return {
        icon: Clock,
        label: 'Unknown',
        description: 'Status unknown',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        variant: 'outline' as const,
      };
  }
};

export function OrderStatusCard({
  order,
  onPaymentClick,
  onDownloadClick,
  isLoading = false,
}: OrderStatusCardProps) {
  const router = useRouter();
  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  const handlePaymentClick = () => {
    if (order.paymentUrl) {
      // Redirect to external payment URL
      window.open(order.paymentUrl, '_blank');
    } else {
      onPaymentClick();
    }
  };

  const handleDownloadClick = () => {
    if (order.downloadUrl) {
      // Direct download
      window.open(order.downloadUrl, '_blank');
    } else {
      onDownloadClick();
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Card className={`${statusConfig.borderColor} ${statusConfig.bgColor}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <StatusIcon
              className={`h-5 w-5 ${statusConfig.color} ${
                order.status === 'processing' ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            />
            <span>Order Status</span>
          </CardTitle>
          <Badge
            variant={statusConfig.variant}
            role="status"
            aria-label={`Order status: ${statusConfig.label}`}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Description */}
        <div>
          <p
            className={`text-sm ${statusConfig.color} font-medium`}
            role="status"
            aria-live="polite"
          >
            {statusConfig.description}
          </p>
        </div>

        {/* Order Details */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Order ID:</span>
              <p className="font-mono text-xs break-all">{order.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">File:</span>
              <p className="truncate">{order.filename}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span>
              <p>{formatFileSize(order.originalFileSize)}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Created:</span>
              <p>{formatDate(order.createdAt)}</p>
            </div>
          </div>

          {order.completedAt && (
            <div className="text-sm">
              <span className="text-muted-foreground">Completed:</span>
              <p>{formatDate(order.completedAt)}</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {order.status === 'failed' && order.errorMessage && (
          <div
            className="p-3 bg-red-100 border border-red-200 rounded-md"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-sm text-red-700">
              <strong>Error:</strong> {order.errorMessage}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {order.status === 'pending_payment' && (
            <Button
              onClick={handlePaymentClick}
              disabled={isLoading}
              className="w-full sm:flex-1"
              aria-describedby="payment-description"
            >
              {isLoading ? (
                <Loader2
                  className="h-4 w-4 mr-2 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Complete Payment
            </Button>
          )}

          {order.status === 'completed' && (
            <Button
              onClick={handleDownloadClick}
              disabled={isLoading}
              className="w-full sm:flex-1"
              aria-describedby="download-description"
            >
              {isLoading ? (
                <Loader2
                  className="h-4 w-4 mr-2 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Download CSV
            </Button>
          )}

          {order.status === 'failed' && (
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full sm:flex-1"
            >
              Try Again
            </Button>
          )}
        </div>

        {/* Processing Animation */}
        {order.status === 'processing' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Processing your document...</span>
              <span>This may take a few minutes</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
