'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  height?: 'sm' | 'md' | 'lg';
  width?: 'full' | 'half' | 'quarter' | 'three-quarters';
  animate?: boolean;
}

const heightClasses = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-6',
};

const widthClasses = {
  full: 'w-full',
  half: 'w-1/2',
  quarter: 'w-1/4',
  'three-quarters': 'w-3/4',
};

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className,
  lines = 1,
  height = 'md',
  width = 'full',
  animate = true,
}) => {
  const skeletonLines = Array.from({ length: lines }, (_, index) => (
    <div
      key={index}
      className={cn(
        'bg-gray-200 rounded',
        heightClasses[height],
        widthClasses[width],
        animate && 'animate-pulse',
        index === lines - 1 && lines > 1 && 'w-3/4', // Last line is shorter
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  ));

  return (
    <div className="space-y-2" data-testid="loading-skeleton">
      {skeletonLines}
    </div>
  );
};

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const spinnerSizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  text,
}) => {
  return (
    <div className={cn('flex items-center justify-center', className)} data-testid="loading-spinner">
      <svg
        className={cn('animate-spin', spinnerSizes[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <span className="ml-2 text-sm text-gray-600" aria-live="polite">
          {text}
        </span>
      )}
    </div>
  );
};

export interface LoadingContentProps {
  isLoading: boolean;
  skeleton?: React.ReactNode;
  spinner?: React.ReactNode;
  children: React.ReactNode;
  type?: 'skeleton' | 'spinner';
}

export const LoadingContent: React.FC<LoadingContentProps> = ({
  isLoading,
  skeleton,
  spinner,
  children,
  type = 'skeleton',
}) => {
  if (isLoading) {
    if (type === 'spinner') {
      return <>{spinner || <LoadingSpinner />}</>;
    }
    return <>{skeleton || <LoadingSkeleton lines={3} />}</>;
  }

  return <>{children}</>;
};