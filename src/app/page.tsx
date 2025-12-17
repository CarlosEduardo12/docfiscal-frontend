'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UploadPage } from '@/components/upload/UploadPage';

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <main className="min-h-screen bg-gray-50" role="main">
      {/* Navigation */}
      <nav
        className="bg-white shadow-sm border-b"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                <Link
                  href="/"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                >
                  DocFiscal
                </Link>
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {status === 'authenticated' ? (
                <>
                  <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-32">
                    Welcome, {session.user.name}
                  </span>
                  <Link href="/dashboard">
                    <Button
                      variant="outline"
                      size="sm"
                      className="sm:size-default"
                    >
                      Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button
                      variant="outline"
                      size="sm"
                      className="sm:size-default"
                    >
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="sm:size-default">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Upload Page Content */}
      <UploadPage />
    </main>
  );
}
