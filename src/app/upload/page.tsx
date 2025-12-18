'use client';

import { useRequireAuth } from '@/hooks/useAuthNew';
import { UploadPage } from '@/components/upload/UploadPage';

export default function UploadPageRoute() {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // useRequireAuth will redirect to login
  }

  return <UploadPage />;
}