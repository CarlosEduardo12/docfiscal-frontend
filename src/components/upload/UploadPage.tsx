'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadArea } from './UploadArea';
import { Card, CardContent } from '@/components/ui/card';
import { useFileUpload } from '@/hooks/useFileUpload';

interface UploadPageProps {
  onFileSelect?: (file: File) => void;
}

export function UploadPage({ onFileSelect }: UploadPageProps) {
  const router = useRouter();

  const { uploadFile, isUploading, error, uploadResponse, reset } =
    useFileUpload({
      onSuccess: (response) => {
        // Navigate to order status page after successful upload
        if (response.order_id) {
          router.push(`/pedido/${response.order_id}`);
        }
      },
      onError: (errorMessage) => {
        console.error('Upload failed:', errorMessage);
      },
    });

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (onFileSelect) {
        onFileSelect(file);
      } else {
        await uploadFile(file);
      }
    },
    [uploadFile, onFileSelect]
  );

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <UploadArea
        onFileSelect={handleFileSelect}
        isUploading={isUploading}
        acceptedFileTypes={['application/pdf']}
        maxFileSize={10 * 1024 * 1024} // 10MB
      />

      {/* Success Message */}
      {uploadResponse && !error && !isUploading && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-green-700">
                <h3 className="text-lg font-semibold">Upload Successful!</h3>
                <p className="text-sm">
                  Your file has been uploaded successfully. You will be
                  redirected to track your order.
                </p>
              </div>
              <div className="text-xs text-green-600">
                Order ID: {uploadResponse.order_id}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
