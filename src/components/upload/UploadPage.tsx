'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadArea } from './UploadArea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useFileUpload } from '@/hooks/useFileUpload';

export function UploadPage() {
  const router = useRouter();

  const { uploadFile, isUploading, progress, error, uploadResponse, reset } =
    useFileUpload({
      onSuccess: (response) => {
        // Navigate to order status page after successful upload
        if (response.orderId) {
          router.push(`/pedido/${response.orderId}`);
        }
      },
      onError: (errorMessage) => {
        console.error('Upload failed:', errorMessage);
      },
    });

  const handleFileSelect = useCallback(
    async (file: File) => {
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-4xl">
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            DocFiscal
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4 sm:px-0">
            Convert your PDF time sheets to CSV format quickly and securely.
            Upload your document and get your converted file in minutes.
          </p>
        </div>

        {/* Upload Section */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Upload Your PDF Document</CardTitle>
            <CardDescription>
              Select your PDF time sheet file to begin the conversion process.
              We support files up to 10MB in size.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadArea
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              acceptedFileTypes={['application/pdf']}
              maxFileSize={10 * 1024 * 1024} // 10MB
            />
          </CardContent>
        </Card>

        {/* Success Message */}
        {uploadResponse && !error && !isUploading && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="text-green-700">
                  <h3 className="text-lg font-semibold">Upload Successful!</h3>
                  <p className="text-sm">
                    Your file has been uploaded successfully. You will be
                    redirected to track your order.
                  </p>
                </div>
                <div className="text-xs text-green-600">
                  Order ID: {uploadResponse.orderId}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 lg:gap-6">
              <div className="text-center space-y-3 sm:space-y-2">
                <div className="w-12 h-12 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-semibold text-lg sm:text-base lg:text-lg">
                    1
                  </span>
                </div>
                <h3 className="font-semibold text-base sm:text-sm lg:text-base">
                  Upload PDF
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select and upload your PDF time sheet document
                </p>
              </div>
              <div className="text-center space-y-3 sm:space-y-2">
                <div className="w-12 h-12 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-semibold text-lg sm:text-base lg:text-lg">
                    2
                  </span>
                </div>
                <h3 className="font-semibold text-base sm:text-sm lg:text-base">
                  Process & Pay
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete payment and we&apos;ll process your document
                </p>
              </div>
              <div className="text-center space-y-3 sm:space-y-2">
                <div className="w-12 h-12 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-primary font-semibold text-lg sm:text-base lg:text-lg">
                    3
                  </span>
                </div>
                <h3 className="font-semibold text-base sm:text-sm lg:text-base">
                  Download CSV
                </h3>
                <p className="text-sm text-muted-foreground">
                  Download your converted CSV file when ready
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Secure & Private
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your documents are processed securely and deleted after
                conversion. We never store your personal data longer than
                necessary.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Fast Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Most documents are processed within minutes. You&apos;ll receive
                an email notification when your file is ready for download.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
