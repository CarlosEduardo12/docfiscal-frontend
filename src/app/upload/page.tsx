'use client';

import { useRequireAuth } from '@/hooks/useAuthNew';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function UploadPageRoute() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page since upload is now integrated there
    if (!isLoading) {
      router.push('/');
    }
  }, [isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return null;
}
