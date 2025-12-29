'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface UploadResponse {
  upload_id: string;
  order_id: string;
  filename: string;
  file_size: number;
  status: string;
  progress?: number;
}

interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: {
    field_errors?: Record<string, string[]>;
    retry_after?: number;
    guidance?: string;
  };
  request_id?: string;
}

export interface UseFileUploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: string, details?: ApiError['details']) => void;
  onProgress?: (progress: number) => void;
}

export interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<void>;
  cancelUpload: () => void;
  retryUpload: () => Promise<void>;
  getUploadProgress: (uploadId: string) => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  errorDetails: ApiError['details'] | null;
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
  const [errorDetails, setErrorDetails] = useState<ApiError['details'] | null>(
    null
  );
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
    setErrorDetails(null);
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

  const handleError = useCallback(
    (errorMessage: string, details?: ApiError['details']) => {
      setError(errorMessage);
      setErrorDetails(details || null);
      setProgress(0);
      onError?.(errorMessage, details);
    },
    [onError]
  );

  const performUpload = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const controller = new AbortController();
      setAbortController(controller);

      try {
        const response = await apiClient.uploadFile(file);

        if (!response.success || !response.data) {
          // Handle standardized error format
          const apiError = response as unknown as ApiError;
          throw new Error(apiError.message || 'Upload failed');
        }

        return response.data;
      } catch (error) {
        // Handle network errors or API errors
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Upload failed');
      } finally {
        setAbortController(null);
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      // Reset previous state
      setError(null);
      setErrorDetails(null);
      setProgress(0);
      setUploadResponse(null);

      // Validate file
      const validationError = validateFileInput(file);
      if (validationError) {
        handleError(validationError);
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
        let errorMessage = 'Upload failed';
        let details: ApiError['details'] | undefined;

        if (uploadError instanceof Error) {
          errorMessage = uploadError.message;

          // Try to parse additional error details if available
          try {
            const errorData = JSON.parse(uploadError.message);
            if (errorData.details) {
              details = errorData.details;
            }
          } catch {
            // Not JSON, use the error message as is
          }
        }

        handleError(errorMessage, details);
      } finally {
        setIsUploading(false);
      }
    },
    [validateFileInput, performUpload, onSuccess, handleError]
  );

  const cancelUpload = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }

    if (uploadResponse?.upload_id) {
      // Call API to cancel upload
      apiClient.cancelUpload(uploadResponse.upload_id).catch((error) => {
        console.error('Failed to cancel upload:', error);
      });
    }

    setIsUploading(false);
    setProgress(0);
    setError('Upload cancelled');
    setErrorDetails(null);
  }, [abortController, uploadResponse]);

  const retryUpload = useCallback(async (): Promise<void> => {
    if (!uploadedFile) {
      handleError('No file to retry upload');
      return;
    }

    await uploadFile(uploadedFile);
  }, [uploadedFile, uploadFile, handleError]);

  const getUploadProgress = useCallback(
    async (uploadId: string): Promise<void> => {
      try {
        const response = await apiClient.getUploadProgress(uploadId);

        if (response.success && response.data) {
          const progressData = response.data;

          if (typeof progressData.progress === 'number') {
            handleProgress(progressData.progress);
          }

          // Update upload response with latest data
          if (uploadResponse && uploadResponse.upload_id === uploadId) {
            setUploadResponse((prev) =>
              prev ? { ...prev, ...progressData } : progressData
            );
          }
        } else {
          throw new Error(response.message || 'Failed to get upload progress');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to get upload progress';
        handleError(errorMessage);
      }
    },
    [uploadResponse, handleProgress, handleError]
  );

  return {
    uploadFile,
    cancelUpload,
    retryUpload,
    getUploadProgress,
    isUploading,
    progress,
    error,
    errorDetails,
    uploadedFile,
    uploadResponse,
    reset,
  };
}
