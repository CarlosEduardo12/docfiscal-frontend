'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OrderHistoryTable } from '@/components/order/OrderHistoryTable';
import { useUserOrders, useDownloadFile } from '@/lib/react-query';
import { Upload, Settings } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useRequireAuth();

  // Fetch user orders
  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
  } = useUserOrders(user?.id || '', {
    page: 1,
    limit: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Download file mutation
  const downloadFile = useDownloadFile();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleDownload = async (orderId: string) => {
    try {
      await downloadFile.mutateAsync(orderId);
    } catch (error) {
      console.error('Download failed:', error);
      // You could add a toast notification here
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Dashboard
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Welcome back, {user?.name}!
              </p>
            </div>
            <Button
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              className="sm:size-default self-start sm:self-auto"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload New File
              </CardTitle>
              <CardDescription>
                Convert a new PDF document to CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="w-full">Start New Upload</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Settings
              </CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Order History */}
        <div className="mb-6 sm:mb-8">
          {ordersError ? (
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">
                    Failed to load order history. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <OrderHistoryTable
              orders={ordersData?.orders || []}
              onDownload={handleDownload}
              isLoading={ordersLoading}
            />
          )}
        </div>

        {/* Statistics Cards */}
        {ordersData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {ordersData.total}
                </div>
                <p className="text-sm text-gray-600">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completed Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {
                    ordersData.orders.filter(
                      (order) => order.status === 'completed'
                    ).length
                  }
                </div>
                <p className="text-sm text-gray-600">Ready for download</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {
                    ordersData.orders.filter(
                      (order) =>
                        order.status === 'processing' || order.status === 'paid'
                    ).length
                  }
                </div>
                <p className="text-sm text-gray-600">In progress</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
