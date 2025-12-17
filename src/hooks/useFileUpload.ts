'use client';

import { useState, useCallback } from 'react';
import { uploadService, handleApiError, retryRequest } from '@/lib/api';
import { validateFile, FILE_VALIDATION_CONFIG } from '@/lib/validations';
import type { UploadResponse, FileUpload } from '@/types';

export interface UseFileUploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<void>;
  cancelUpload: () => void;
  retryUpload: () => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedFile: File | null;
  uploadResponse: UploadResponse | null;
  reset: () => void;
}

export function useFileUpload(
  options: UseFileUploadOptions = {}
): UseFileUploadReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
    onProgress,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(
    null
  );
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setUploadedFile(null);
    setUploadResponse(null);
    setAbortController(null);
  }, []);

  const validateFileInput = useCallback((file: File): string | null => {
    try {
      // Validate file type
      if (
        !FILE_VALIDATION_CONFIG.acceptedFileTypes.includes(file.type as any)
      ) {
        return 'Only PDF files are allowed';
      }

      // Validate file size
      if (file.size > FILE_VALIDATION_CONFIG.maxFileSize) {
        const maxSizeMB = Math.round(
          FILE_VALIDATION_CONFIG.maxFileSize / (1024 * 1024)
        );
        return `File size must be less than ${maxSizeMB}MB`;
      }

      // Validate file name
      if (!file.name || file.name.trim().length === 0) {
        return 'File must have a name';
      }

      // Additional validation using Zod schema
      validateFile(file);

      return null;
    } catch (validationError) {
      if (validationError instanceof Error) {
        return validationError.message;
      }
      return 'File validation failed';
    }
  }, []);

  const handleProgress = useCallback(
    (progressValue: number) => {
      setProgress(progressValue);
      onProgress?.(progressValue);
    },
    [onProgress]
  );

  const performUpload = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await retryRequest(
          async () => {
            // Check if upload was cancelled
            if (controller.signal.aborted) {
              throw new Error('Upload cancelled');
            }

            return uploadService.uploadFile(file, handleProgress);
          },
          maxRetries,
          retryDelay
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Upload failed');
        }

        return response.data;
      } finally {
        setAbortController(null);
      }
    },
    [maxRetries, retryDelay, handleProgress]
  );

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      // Reset previous state
      setError(null);
      setProgress(0);
      setUploadResponse(null);

      // Validate file
      const validationError = validateFileInput(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      setIsUploading(true);
      setUploadedFile(file);

      try {
        const response = await performUpload(file);
        setUploadResponse(response);
        setProgress(100);
        onSuccess?.(response);
      } catch (uploadError) {
        const errorMessage = handleApiError(uploadError);
        setError(errorMessage);
        setProgress(0);
        onError?.(errorMessage);
      } finally {
        setIsUploading(false);
      }
    },
    [validateFileInput, performUpload, onSuccess, onError]
  );

  const cancelUpload = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setIsUploading(false);
    setProgress(0);
    setError('Upload cancelled');
  }, [abortController]);

  const retryUpload = useCallback(async (): Promise<void> => {
    if (!uploadedFile) {
      setError('No file to retry upload');
      return;
    }

    await uploadFile(uploadedFile);
  }, [uploadedFile, uploadFile]);

  return {
    uploadFile,
    cancelUpload,
    retryUpload,
    isUploading,
    progress,
    error,
    uploadedFile,
    uploadResponse,
    reset,
  };
}
