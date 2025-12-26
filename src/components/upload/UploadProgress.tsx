/**
 * Enhanced UploadProgress component with accurate progress tracking
 * Implements Requirements 3.3 from frontend-issues-resolution spec
 */

import React from 'react';
import { CheckCircle, AlertCircle, X, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UploadProgressProps {
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  fileName: string;
  fileSize?: number;
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function UploadProgress({
  progress,
  status,
  fileName,
  fileSize,
  uploadSpeed,
  estimatedTimeRemaining,
  error,
  onCancel,
  onRetry,
  className
}: UploadProgressProps) {
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    const kb = bytes / 1024;
    
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    } else if (kb >= 1) {
      return `${kb.toFixed(1)} KB`;
    } else {
      return `${bytes} bytes`;
    }
  };

  const formatUploadSpeed = (bytesPerSecond: number): string => {
    const mbps = bytesPerSecond / (1024 * 1024);
    const kbps = bytesPerSecond / 1024;
    
    if (mbps >= 1) {
      return `${mbps.toFixed(1)} MB/s`;
    } else if (kbps >= 1) {
      return `${kbps.toFixed(1)} KB/s`;
    } else {
      return `${bytesPerSecond} B/s`;
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Enviando arquivo...';
      case 'processing':
        return 'Processando arquivo...';
      case 'completed':
        return 'Upload concluído com sucesso!';
      case 'error':
        return 'Erro no upload';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600';
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={cn('w-full p-4 border rounded-lg bg-white shadow-sm', className)}>
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={cn('font-medium', getStatusColor())}>
            {getStatusText()}
          </span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {onCancel && (status === 'uploading' || status === 'processing') && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="h-3 w-3 mr-1" />
              Cancelar
            </Button>
          )}
          
          {onRetry && status === 'error' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-blue-600 hover:text-blue-800"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Tentar Novamente
            </Button>
          )}
        </div>
      </div>

      {/* File Information */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>
          {fileName}
        </p>
        {fileSize && (
          <p className="text-xs text-gray-500">
            Tamanho: {formatFileSize(fileSize)}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="mb-3">
          <Progress 
            value={progress} 
            className="w-full h-2"
            aria-label={`Upload progress: ${progress}%`}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-medium text-gray-700">
              {progress}%
            </span>
            
            {/* Speed and Time Information */}
            <div className="text-xs text-gray-500 space-x-2">
              {uploadSpeed && (
                <span>{formatUploadSpeed(uploadSpeed)}</span>
              )}
              {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
                <span>• {formatTimeRemaining(estimatedTimeRemaining)} restantes</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success Message */}
      {status === 'completed' && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          Arquivo enviado e processado com sucesso!
        </div>
      )}
    </div>
  );
}