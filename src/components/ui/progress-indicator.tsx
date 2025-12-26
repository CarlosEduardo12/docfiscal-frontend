'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from './progress';

export interface ProgressIndicatorProps {
  progress: number;
  estimatedTimeRemaining?: number | null;
  elapsedTime?: number;
  stage?: string;
  showTimeEstimate?: boolean;
  showElapsedTime?: boolean;
  showPercentage?: boolean;
  className?: string;
}

const formatTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  estimatedTimeRemaining,
  elapsedTime,
  stage,
  showTimeEstimate = true,
  showElapsedTime = false,
  showPercentage = true,
  className,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const hasTimeEstimate = estimatedTimeRemaining !== null && estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0;

  return (
    <div className={cn('space-y-2', className)} data-testid="progress-indicator">
      {/* Progress bar */}
      <Progress value={clampedProgress} className="w-full" />
      
      {/* Progress info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          {showPercentage && (
            <span data-testid="progress-percentage">
              {Math.round(clampedProgress)}%
            </span>
          )}
          {stage && (
            <span data-testid="progress-stage" className="text-gray-500">
              • {stage}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {showElapsedTime && elapsedTime !== undefined && (
            <span data-testid="elapsed-time" className="text-gray-500">
              {formatTime(elapsedTime)}
            </span>
          )}
          
          {showTimeEstimate && hasTimeEstimate && (
            <span data-testid="time-remaining" className="text-gray-500">
              ~{formatTime(estimatedTimeRemaining!)} remaining
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 64,
  strokeWidth = 4,
  showPercentage = true,
  className,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      data-testid="circular-progress"
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-blue-600 transition-all duration-300 ease-in-out"
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-700">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
};