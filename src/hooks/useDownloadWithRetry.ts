import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface DownloadError {
  code: string;
  message: string;
  status?: number;
  details?: any;
}

interface DownloadRetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError?: DownloadError;
  canRetry: boolean;
}

export const useDownloadWithRetry = () => {
  const [retryState, setRetryState] = useState<DownloadRetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: undefined,
    canRetry: false,
  });

  const downloadMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { blob, filename } = await apiClient.downloadOrder(orderId);

      // Use filename from Content-Disposition header if available, otherwise fallback
      const downloadFilename = filename || `converted-${orderId}.csv`;

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Reset retry state on successful download
      setRetryState({
        isRetrying: false,
        retryCount: 0,
        lastError: undefined,
        canRetry: false,
      });

      return { success: true, filename: downloadFilename };
    },
    onError: (error: any) => {
      const downloadError: DownloadError = {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Download failed',
        status: error.status,
        details: error.details,
      };

      setRetryState((prev) => ({
        isRetrying: false,
        retryCount: prev.retryCount + 1,
        lastError: downloadError,
        canRetry:
          downloadError.code === 'DOWNLOAD_LINK_EXPIRED' && prev.retryCount < 3,
      }));
    },
  });

  const retryDownload = async (orderId: string) => {
    if (!retryState.canRetry) {
      throw new Error('Cannot retry download');
    }

    setRetryState((prev) => ({ ...prev, isRetrying: true }));

    try {
      // For expired links, we might need to regenerate the download link
      // This could involve calling a regenerate endpoint or retrying the order
      if (retryState.lastError?.code === 'DOWNLOAD_LINK_EXPIRED') {
        // First try to retry the order to regenerate the download link
        await apiClient.retryOrder(orderId);

        // Wait a moment for the system to process the retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Now attempt the download again
      await downloadMutation.mutateAsync(orderId);
    } catch (error) {
      setRetryState((prev) => ({ ...prev, isRetrying: false }));
      throw error;
    }
  };

  const resetRetryState = () => {
    setRetryState({
      isRetrying: false,
      retryCount: 0,
      lastError: undefined,
      canRetry: false,
    });
  };

  const getErrorMessage = (): string => {
    if (!retryState.lastError) return '';

    switch (retryState.lastError.code) {
      case 'DOWNLOAD_LINK_EXPIRED':
        return 'Download link has expired. You can retry to generate a new link.';
      case 'ORDER_NOT_FOUND':
        return 'Order not found. Please check if the order exists.';
      case 'DOWNLOAD_FAILED':
        return 'Download failed. Please try again later.';
      default:
        return (
          retryState.lastError.message || 'An error occurred during download.'
        );
    }
  };

  const getRetryOptions = () => {
    if (!retryState.lastError) return [];

    const options = [];

    if (retryState.canRetry) {
      options.push({
        label: 'Retry Download',
        action: 'retry',
        description: 'Attempt to regenerate and download the file again',
      });
    }

    if (retryState.lastError.code === 'DOWNLOAD_LINK_EXPIRED') {
      options.push({
        label: 'Go to Order History',
        action: 'order_history',
        description: 'View your order history to access the file',
      });
    }

    return options;
  };

  return {
    download: downloadMutation.mutateAsync,
    retryDownload,
    resetRetryState,
    isLoading: downloadMutation.isPending,
    isRetrying: retryState.isRetrying,
    error: retryState.lastError,
    canRetry: retryState.canRetry,
    retryCount: retryState.retryCount,
    getErrorMessage,
    getRetryOptions,
  };
};
