'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface DisabledOverlayProps {
  isDisabled: boolean;
  reason?: string;
  tooltip?: string;
  visualCue?: 'loading' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
  showOverlay?: boolean;
  showTooltip?: boolean;
}

const visualCueStyles = {
  loading: 'bg-blue-50 border-blue-200',
  error: 'bg-red-50 border-red-200',
  warning: 'bg-yellow-50 border-yellow-200',
  info: 'bg-gray-50 border-gray-200',
};

const visualCueIcons = {
  loading: (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
};

export const DisabledOverlay: React.FC<DisabledOverlayProps> = ({
  isDisabled,
  reason,
  tooltip,
  visualCue,
  children,
  className,
  showOverlay = true,
  showTooltip = true,
}) => {
  const displayMessage = tooltip || reason;

  if (!isDisabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn('relative', className)}
      data-testid="disabled-overlay"
      data-disabled="true"
      data-reason={reason}
      data-visual-cue={visualCue}
    >
      {/* Original content with disabled styling */}
      <div
        className={cn(
          'transition-all duration-200',
          isDisabled && 'opacity-50 pointer-events-none select-none'
        )}
        aria-disabled={isDisabled}
      >
        {children}
      </div>

      {/* Overlay with visual cues */}
      {showOverlay && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'transition-all duration-200',
            visualCue && visualCueStyles[visualCue],
            visualCue && 'border rounded-md'
          )}
          role="presentation"
        >
          {visualCue && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-white rounded-md shadow-sm border">
              {visualCueIcons[visualCue]}
              {displayMessage && showTooltip && (
                <span className="text-sm text-gray-700">{displayMessage}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tooltip for accessibility */}
      {displayMessage && (
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-label={displayMessage}
        >
          {displayMessage}
        </div>
      )}
    </div>
  );
};

export interface DisabledButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isDisabled?: boolean;
  reason?: string;
  tooltip?: string;
  visualCue?: 'loading' | 'error' | 'warning' | 'info';
  showVisualCue?: boolean;
}

export const DisabledButton: React.FC<DisabledButtonProps> = ({
  isDisabled = false,
  reason,
  tooltip,
  visualCue,
  showVisualCue = true,
  children,
  className,
  disabled,
  ...props
}) => {
  const isActuallyDisabled = isDisabled || disabled;
  const displayMessage = tooltip || reason;

  return (
    <button
      {...props}
      disabled={isActuallyDisabled}
      className={cn(
        'relative transition-all duration-200',
        isActuallyDisabled && [
          'opacity-50 cursor-not-allowed',
          visualCue === 'loading' && 'animate-pulse',
          visualCue === 'error' && 'border-red-300 text-red-600',
          visualCue === 'warning' && 'border-yellow-300 text-yellow-600',
          visualCue === 'info' && 'border-blue-300 text-blue-600',
        ],
        className
      )}
      aria-disabled={isActuallyDisabled}
      aria-label={displayMessage}
      title={displayMessage}
      data-testid="disabled-button"
      data-disabled={isActuallyDisabled}
      data-reason={reason}
      data-visual-cue={visualCue}
    >
      <div className="flex items-center justify-center space-x-2">
        {isActuallyDisabled && visualCue && showVisualCue && (
          <span className="flex-shrink-0">
            {visualCueIcons[visualCue]}
          </span>
        )}
        <span>{children}</span>
      </div>
    </button>
  );
};