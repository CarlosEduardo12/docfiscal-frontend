'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

interface UploadResponse {
  upload_id: string;
  order_id: string;
  filename: string;
  file_size: number;
  status: string;
  progress: number;
}

export interface UseFileUploadWithRetryOptions {
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export interface UseFileUploadWithRetryReturn {
  uploadFile: (file: File) => Promise<void>;
  cancelUpload: () => void;
  retryUpload: () => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedFile: File | null;
  uploadResponse: UploadResponse | null;
  retryCount: number;
  reset: () => void;
}

export function useFileUploadWithRetry(
  options: UseFileUploadWithRetryOptions = {}
): UseFileUploadWithRetryReturn {
  const {
    maxRetries = 3,
    baseRetryDelay = 1000,
    maxRetryDelay = 30000,
    onSuccess,
    onError,
    onProgress,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setUploadedFile(null);
    setUploadResponse(null);
    setRetryCount(0);
    setAbortController(null);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
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

  const calculateRetryDelay = useCallback((attempt: number): number => {
    const exponentialDelay = baseRetryDelay * Math.pow(2, attempt);
    return Math.min(exponentialDelay, maxRetryDelay);
  }, [baseRetryDelay, maxRetryDelay]);

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
    []
  );

  const uploadFileWithRetry = useCallback(
    async (file: File, currentRetryCount: number = 0): Promise<void> => {
      // Reset progress and error for new attempt
      setError(null);
      setProgress(0);
      setRetryCount(currentRetryCount);

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
        setRetryCount(0); // Reset retry count on success
        onSuccess?.(response);
      } catch (uploadError) {
        const errorMessage =
          uploadError instanceof Error ? uploadError.message : 'Upload failed';
        
        // Check if we should retry
        if (currentRetryCount < maxRetries && isRetryableError(uploadError)) {
          const retryDelay = calculateRetryDelay(currentRetryCount);
          
          setError(`Upload failed. Retrying in ${Math.ceil(retryDelay / 1000)}s... (Attempt ${currentRetryCount + 1}/${maxRetries})`);
          
          // Schedule retry with exponential backoff
          retryTimeoutRef.current = setTimeout(async () => {
            await uploadFileWithRetry(file, currentRetryCount + 1);
          }, retryDelay);
        } else {
          // Max retries reached or non-retryable error
          setError(errorMessage);
          setProgress(0);
          setRetryCount(0);
          onError?.(errorMessage);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [validateFileInput, performUpload, onSuccess, onError, maxRetries, calculateRetryDelay]
  );

  const isRetryableError = useCallback((error: any): boolean => {
    // Define which errors are retryable
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('server error') ||
        message.includes('503') ||
        message.includes('502') ||
        message.includes('500')
      );
    }
    return true; // Default to retryable for unknown errors
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      // Reset previous state
      setUploadResponse(null);
      setRetryCount(0);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      await uploadFileWithRetry(file, 0);
    },
    [uploadFileWithRetry]
  );

  const cancelUpload = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    setIsUploading(false);
    setProgress(0);
    setError('Upload cancelled');
    setRetryCount(0);
  }, [abortController]);

  const retryUpload = useCallback(async (): Promise<void> => {
    if (!uploadedFile) {
      setError('No file to retry upload');
      return;
    }

    // Start retry from current retry count
    await uploadFileWithRetry(uploadedFile, retryCount);
  }, [uploadedFile, uploadFileWithRetry, retryCount]);

  return {
    uploadFile,
    cancelUpload,
    retryUpload,
    isUploading,
    progress,
    error,
    uploadedFile,
    uploadResponse,
    retryCount,
    reset,
  };
}