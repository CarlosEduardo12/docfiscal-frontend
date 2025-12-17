'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { UploadAreaProps } from '@/types';
import { FILE_VALIDATION_CONFIG } from '@/lib/validations';
import { useFileUpload } from '@/hooks/useFileUpload';

export function UploadArea({
  onFileSelect,
  isUploading: externalIsUploading = false,
  acceptedFileTypes = FILE_VALIDATION_CONFIG.acceptedFileTypes,
  maxFileSize = FILE_VALIDATION_CONFIG.maxFileSize,
  disabled = false,
}: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    uploadFile,
    cancelUpload,
    retryUpload,
    isUploading: hookIsUploading,
    progress,
    error,
    uploadedFile,
    uploadResponse,
    reset,
  } = useFileUpload({
    onSuccess: (response) => {
      // Call the parent callback with the uploaded file
      if (uploadedFile) {
        onFileSelect(uploadedFile);
      }
    },
    onError: (errorMessage) => {
      console.error('Upload failed:', errorMessage);
    },
  });

  // Use either external or hook uploading state
  const isUploading = externalIsUploading || hookIsUploading;

  const handleFileSelection = useCallback(
    async (file: File) => {
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setIsDragOver(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set drag over to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isUploading) {
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileSelection(files[0]);
      }
    },
    [disabled, isUploading, handleFileSelection]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelection(files[0]);
      }

      // Reset the input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFileSelection]
  );

  const handleButtonClick = useCallback(() => {
    if (fileInputRef.current && !disabled && !isUploading) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${Math.round(mb)}MB`;
  };

  const isInteractive = !disabled && !isUploading;

  return (
    <Card
      className={cn(
        'w-full transition-all duration-200',
        isDragOver && isInteractive && 'border-primary bg-primary/5',
        !isInteractive && 'opacity-60 cursor-not-allowed'
      )}
    >
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg p-4 sm:p-6 lg:p-8 text-center transition-all duration-200',
            isDragOver && isInteractive
              ? 'border-primary bg-primary/10'
              : 'border-muted-foreground/25',
            isInteractive &&
              'hover:border-primary/50 hover:bg-primary/5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            !isInteractive && 'cursor-not-allowed'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleButtonClick}
          role="button"
          tabIndex={isInteractive ? 0 : -1}
          aria-label={
            isUploading ? 'File upload in progress' : 'Upload PDF file'
          }
          aria-describedby="upload-description upload-requirements"
          onKeyDown={(e) => {
            if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              handleButtonClick();
            }
          }}
        >
          {/* Hidden file input for accessibility */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileInputChange}
            className="sr-only"
            disabled={!isInteractive}
            aria-describedby="upload-description"
          />

          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            {isUploading ? (
              <>
                <div className="relative">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary" />
                  {progress > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">{progress}%</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-base sm:text-lg font-medium">
                    Uploading your file...
                  </p>
                  <p className="text-sm text-muted-foreground px-2">
                    {uploadedFile?.name ||
                      'Please wait while we process your PDF'}
                  </p>
                  {progress > 0 && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelUpload();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Upload
                </Button>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    'rounded-full p-3 sm:p-4 transition-colors',
                    isDragOver && isInteractive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  {isDragOver ? (
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
                  ) : (
                    <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
                  )}
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-base sm:text-lg font-medium">
                    {isDragOver
                      ? 'Drop your PDF file here'
                      : 'Upload your PDF file'}
                  </p>
                  <p
                    id="upload-description"
                    className="text-sm text-muted-foreground px-2"
                  >
                    Drag and drop your PDF file here, or click to browse
                  </p>
                </div>

                <Button
                  variant="outline"
                  disabled={!isInteractive}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleButtonClick();
                  }}
                >
                  Choose File
                </Button>
              </>
            )}
          </div>

          {/* File requirements */}
          <div className="mt-6 pt-4 border-t border-muted-foreground/10">
            <p
              id="upload-requirements"
              className="text-xs text-muted-foreground"
            >
              Supported format: PDF • Maximum size:{' '}
              {formatFileSize(maxFileSize)}
            </p>
          </div>
        </div>

        {/* Error display with retry option */}
        {error && (
          <div
            className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20"
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              {uploadedFile && error !== 'Upload cancelled' && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      retryUpload();
                    }}
                    disabled={isUploading}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success display */}
        {uploadResponse && !error && !isUploading && (
          <div
            className="mt-4 p-3 rounded-md bg-green-50 border border-green-200"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center space-x-2 text-green-700">
              <FileText className="h-4 w-4" aria-hidden="true" />
              <p className="text-sm font-medium">
                File uploaded successfully! Order ID: {uploadResponse.orderId}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
