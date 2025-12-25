'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload,
  FileText,
  Download,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { useUserOrders } from '@/lib/react-query';

interface SidebarProps {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  // Fetch recent orders for authenticated users
  const { data: ordersData } = useUserOrders(
    user?.id || '',
    {
      page: 1,
      limit: 5,
      sort_by: 'created_at',
      sort_order: 'desc',
    },
    {
      enabled: !!user?.id,
    }
  );

  const navigationItems = [
    {
      href: '/',
      icon: Upload,
      label: 'Convert',
      active: pathname === '/',
    },
    {
      href: '/dashboard',
      icon: FileText,
      label: 'All files',
      active: pathname === '/dashboard',
      requireAuth: true,
    },
    {
      href: '/dashboard',
      icon: Download,
      label: 'History',
      active: false,
      requireAuth: true,
    },
    {
      href: '/dashboard',
      icon: Settings,
      label: 'Settings',
      active: false,
      requireAuth: true,
    },
  ];

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatFileName = (filename: string): string => {
    if (filename.length > 20) {
      return filename.substring(0, 17) + '...';
    }
    return filename;
  };

  return (
    <div className="w-64 bg-gray-50 p-6 border-r min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl text-gray-900">DocFiscal</span>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 mb-8">
        {navigationItems.map((item) => {
          if (item.requireAuth && !user) return null;

          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                item.active
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className={item.active ? 'font-medium' : ''}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Recent Files - Only show for authenticated users */}
      {user && ordersData?.orders && ordersData.orders.length > 0 && (
        <div className="mb-8">
          <h4 className="font-semibold text-gray-900 mb-4">Recent Files</h4>
          <div className="space-y-3">
            {ordersData.orders.slice(0, 3).map((order: any) => (
              <Link key={order.id} href={`/pedido/${order.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {formatFileName(
                            order.original_filename || 'document.pdf'
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatFileSize(order.file_size || 0)}</span>
                          <span>•</span>
                          <span
                            className={`capitalize ${
                              order.status === 'completed'
                                ? 'text-green-600'
                                : order.status === 'processing'
                                  ? 'text-blue-600'
                                  : order.status === 'failed'
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="mt-auto">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                Sign In
              </Button>
            </Link>
            <Link href="/register" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Sign Up
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
