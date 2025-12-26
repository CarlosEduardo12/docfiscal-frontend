'use client';

import React from 'react';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';

// Loading spinner component
const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={cn('animate-spin h-4 w-4', className)}
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
);

export interface LoadingButtonProps extends ButtonProps {
  loading: boolean;
  loadingText?: string;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading, loadingText, children, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          'relative',
          loading && 'cursor-not-allowed',
          className
        )}
        {...props}
      >
        {loading && (
          <LoadingSpinner className="mr-2" />
        )}
        {loading ? (loadingText || 'Loading...') : children}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';