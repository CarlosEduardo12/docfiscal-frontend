'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UploadResponse {
  upload_id: string;
  order_id: string;
  filename: string;
  file_size: number;
  status: string;
  progress: number;
}

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
      if (file.type !== 'application/pdf') {
        return 'Only PDF files are allowed';
      }

      // Validate file size (10MB max)
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxFileSize) {
        return 'File size must be less than 10MB';
      }

      // Validate file name
      if (!file.name || file.name.trim().length === 0) {
        return 'File must have a name';
      }

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
        const response = await apiClient.uploadFile(file);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Upload failed');
        }

        return response.data;
      } finally {
        setAbortController(null);
      }
    },
    [handleProgress]
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
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Upload failed';
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
