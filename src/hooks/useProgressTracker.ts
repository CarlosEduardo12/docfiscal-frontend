'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ProgressState {
  progress: number; // 0-100
  isActive: boolean;
  estimatedTimeRemaining: number | null; // in milliseconds
  elapsedTime: number; // in milliseconds
  averageSpeed: number | null; // progress units per millisecond
  stage?: string;
}

export interface UseProgressTrackerOptions {
  updateInterval?: number; // milliseconds
  smoothingFactor?: number; // 0-1, for speed calculation smoothing
}

export function useProgressTracker(options: UseProgressTrackerOptions = {}) {
  const { updateInterval = 100, smoothingFactor = 0.3 } = options;
  
  const [state, setState] = useState<ProgressState>({
    progress: 0,
    isActive: false,
    estimatedTimeRemaining: null,
    elapsedTime: 0,
    averageSpeed: null,
  });

  const startTimeRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(0);
  const speedHistoryRef = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateSpeed = useCallback((currentProgress: number, currentTime: number) => {
    if (lastUpdateRef.current === null || lastProgressRef.current === currentProgress) {
      return null;
    }

    const timeDelta = currentTime - lastUpdateRef.current;
    const progressDelta = currentProgress - lastProgressRef.current;
    
    if (timeDelta <= 0) return null;

    const instantSpeed = progressDelta / timeDelta;
    
    // Add to speed history for smoothing
    speedHistoryRef.current.push(instantSpeed);
    if (speedHistoryRef.current.length > 10) {
      speedHistoryRef.current.shift();
    }

    // Calculate smoothed average speed
    const weights = speedHistoryRef.current.map((_, index) => 
      Math.pow(smoothingFactor, speedHistoryRef.current.length - 1 - index)
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const weightedSum = speedHistoryRef.current.reduce((sum, speed, index) => 
      sum + speed * weights[index], 0
    );

    return weightedSum / totalWeight;
  }, [smoothingFactor]);

  const calculateTimeRemaining = useCallback((currentProgress: number, speed: number | null) => {
    if (speed === null || speed <= 0 || currentProgress >= 100) {
      return null;
    }

    const remainingProgress = 100 - currentProgress;
    return remainingProgress / speed;
  }, []);

  const updateProgress = useCallback((newProgress: number, stage?: string) => {
    const currentTime = Date.now();
    
    setState(prevState => {
      if (!prevState.isActive) return prevState;

      const clampedProgress = Math.max(0, Math.min(100, newProgress));
      const elapsedTime = startTimeRef.current ? currentTime - startTimeRef.current : 0;
      
      const speed = calculateSpeed(clampedProgress, currentTime);
      const estimatedTimeRemaining = calculateTimeRemaining(clampedProgress, speed);

      lastUpdateRef.current = currentTime;
      lastProgressRef.current = clampedProgress;

      return {
        ...prevState,
        progress: clampedProgress,
        elapsedTime,
        averageSpeed: speed,
        estimatedTimeRemaining,
        stage: stage !== undefined ? stage : prevState.stage,
      };
    });
  }, [calculateSpeed, calculateTimeRemaining]);

  const start = useCallback((initialProgress: number = 0, stage?: string) => {
    const currentTime = Date.now();
    startTimeRef.current = currentTime;
    lastUpdateRef.current = currentTime;
    lastProgressRef.current = initialProgress;
    speedHistoryRef.current = [];

    setState({
      progress: Math.max(0, Math.min(100, initialProgress)),
      isActive: true,
      estimatedTimeRemaining: null,
      elapsedTime: 0,
      averageSpeed: null,
      stage: stage || undefined, // Ensure stage is set properly
    });

    // Start automatic time updates
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setState(prevState => {
        if (!prevState.isActive || !startTimeRef.current) return prevState;
        
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTimeRef.current;
        
        return {
          ...prevState,
          elapsedTime,
        };
      });
    }, updateInterval);
  }, [updateInterval]);

  const complete = useCallback((finalStage?: string) => {
    setState(prevState => ({
      ...prevState,
      progress: 100,
      isActive: false,
      estimatedTimeRemaining: null,
      stage: finalStage || prevState.stage,
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      progress: 0,
      isActive: false,
      estimatedTimeRemaining: null,
      elapsedTime: 0,
      averageSpeed: null,
    });

    startTimeRef.current = null;
    lastUpdateRef.current = null;
    lastProgressRef.current = 0;
    speedHistoryRef.current = [];

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      isActive: false,
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      isActive: true,
    }));

    // Restart automatic time updates
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setState(prevState => {
        if (!prevState.isActive || !startTimeRef.current) return prevState;
        
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTimeRef.current;
        
        return {
          ...prevState,
          elapsedTime,
        };
      });
    }, updateInterval);
  }, [updateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    updateProgress,
    start,
    complete,
    reset,
    pause,
    resume,
  };
}