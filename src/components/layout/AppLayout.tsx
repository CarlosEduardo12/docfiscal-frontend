'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  onLogout: () => void;
}

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-7xl mx-auto bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-0">
            <div className="flex">
              <Sidebar user={user} onLogout={onLogout} />
              <div className="flex-1 p-8 overflow-auto">{children}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
