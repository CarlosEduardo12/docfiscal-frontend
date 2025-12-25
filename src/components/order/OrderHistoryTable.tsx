'use client';

import React from 'react';
import { format } from 'date-fns';
import {
  Download,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { Order, OrderHistoryTableProps } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const getStatusIcon = (status: Order['status']) => {
  switch (status) {
    case 'pending_payment':
      return <CreditCard className="h-4 w-4" />;
    case 'paid':
    case 'processing':
      return <Clock className="h-4 w-4" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'failed':
      return <XCircle className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getStatusBadgeVariant = (status: Order['status']) => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
    case 'paid':
      return 'secondary';
    case 'pending_payment':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusLabel = (status: Order['status']) => {
  switch (status) {
    case 'pending_payment':
      return 'Pending Payment';
    case 'paid':
      return 'Paid';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function OrderHistoryTable({
  orders,
  onDownload,
  onPayment,
  isLoading,
  pagination,
  onPageChange,
}: OrderHistoryTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-gray-600">
              Loading orders...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No orders yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload your first PDF document to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort orders by most recent first
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order History</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full" role="table" aria-label="Order history">
              <thead>
                <tr className="border-b">
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900"
                    scope="col"
                  >
                    File
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900"
                    scope="col"
                  >
                    Date
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900"
                    scope="col"
                  >
                    Status
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-gray-900"
                    scope="col"
                  >
                    Size
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium text-gray-900"
                    scope="col"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <FileText
                          className="h-5 w-5 text-gray-400 mr-3"
                          aria-hidden="true"
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {order.filename}
                          </div>
                          <div className="text-sm text-gray-500">
                            Order #{order.id.slice(-8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">
                      {format(new Date(order.createdAt), 'MMM dd, yyyy')}
                      <div className="text-xs text-gray-500">
                        {format(new Date(order.createdAt), 'HH:mm')}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={getStatusBadgeVariant(order.status)}
                        className="flex items-center gap-1 w-fit"
                      >
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-900">
                      {formatFileSize(order.originalFileSize)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {order.status === 'pending_payment' && (
                          <Button
                            size="sm"
                            onClick={() => onPayment?.(order.id)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                            aria-label={`Make payment for ${order.filename}`}
                          >
                            <CreditCard
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            Pay Now
                          </Button>
                        )}
                        {order.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDownload(order.id)}
                            className="flex items-center gap-2"
                            aria-label={`Download CSV file for ${order.filename}`}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Download
                          </Button>
                        )}
                        {(order.status === 'processing' ||
                          order.status === 'paid') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="flex items-center gap-2"
                          >
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            Processing
                          </Button>
                        )}
                      </div>
                      {order.status === 'failed' && order.errorMessage && (
                        <div className="text-xs text-red-600 max-w-32 truncate mt-1">
                          {order.errorMessage}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div
          className="md:hidden space-y-4"
          role="list"
          aria-label="Order history"
        >
          {sortedOrders.map((order) => (
            <div
              key={order.id}
              className="border rounded-lg p-4 bg-white hover:bg-gray-50"
              role="listitem"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <FileText
                    className="h-5 w-5 text-gray-400 mr-3"
                    aria-hidden="true"
                  />
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {order.filename}
                    </div>
                    <div className="text-xs text-gray-500">
                      Order #{order.id.slice(-8)}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={getStatusBadgeVariant(order.status)}
                  className="flex items-center gap-1"
                >
                  {getStatusIcon(order.status)}
                  {getStatusLabel(order.status)}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                <span>
                  {format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm')}
                </span>
                <span>{formatFileSize(order.originalFileSize)}</span>
              </div>

              <div className="space-y-2">
                {order.status === 'pending_payment' && (
                  <Button
                    size="sm"
                    onClick={() => onPayment?.(order.id)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
                    aria-label={`Make payment for ${order.filename}`}
                  >
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Pay Now
                  </Button>
                )}

                {order.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload(order.id)}
                    className="w-full flex items-center justify-center gap-2"
                    aria-label={`Download CSV file for ${order.filename}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download CSV
                  </Button>
                )}

                {(order.status === 'processing' || order.status === 'paid') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Processing...
                  </Button>
                )}

                {order.status === 'failed' && order.errorMessage && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {order.errorMessage}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination (if provided) */}
        {pagination && onPageChange && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="text-sm text-gray-700">
              Showing page {pagination.page || 1}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange((pagination.page || 1) - 1)}
                disabled={(pagination.page || 1) <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPageChange((pagination.page || 1) + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
