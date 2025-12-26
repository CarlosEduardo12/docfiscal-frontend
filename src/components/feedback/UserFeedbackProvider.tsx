'use client';

import React, { createContext, useContext } from 'react';
import { useToast } from '../../hooks/useToast';
import { useFormSubmission } from '../../hooks/useFormSubmission';
import { useDataLoading } from '../../hooks/useDataLoading';
import { useProgressTracker } from '../../hooks/useProgressTracker';
import { useInteractionState } from '../../hooks/useInteractionState';
import { ToastContainer } from '../ui/toast';

interface UserFeedbackContextType {
  toast: ReturnType<typeof useToast>;
  formSubmission: ReturnType<typeof useFormSubmission>;
  dataLoading: ReturnType<typeof useDataLoading>;
  progressTracker: ReturnType<typeof useProgressTracker>;
  interactionState: ReturnType<typeof useInteractionState>;
}

const UserFeedbackContext = createContext<UserFeedbackContextType | null>(null);

export interface UserFeedbackProviderProps {
  children: React.ReactNode;
  toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
  defaultToastDuration?: number;
}

export const UserFeedbackProvider: React.FC<UserFeedbackProviderProps> = ({
  children,
  toastPosition = 'top-right',
  maxToasts = 5,
  defaultToastDuration = 5000,
}) => {
  const toast = useToast({ maxToasts, defaultDuration: defaultToastDuration });
  const formSubmission = useFormSubmission();
  const dataLoading = useDataLoading();
  const progressTracker = useProgressTracker();
  const interactionState = useInteractionState();

  const contextValue: UserFeedbackContextType = {
    toast,
    formSubmission,
    dataLoading,
    progressTracker,
    interactionState,
  };

  return (
    <UserFeedbackContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toast.toasts}
        onDismiss={toast.removeToast}
        position={toastPosition}
      />
    </UserFeedbackContext.Provider>
  );
};

export const useUserFeedback = () => {
  const context = useContext(UserFeedbackContext);
  if (!context) {
    throw new Error('useUserFeedback must be used within a UserFeedbackProvider');
  }
  return context;
};

// Convenience hooks for individual feedback systems
export const useToastFeedback = () => {
  const { toast } = useUserFeedback();
  return toast;
};

export const useFormFeedback = () => {
  const { formSubmission } = useUserFeedback();
  return formSubmission;
};

export const useDataFeedback = () => {
  const { dataLoading } = useUserFeedback();
  return dataLoading;
};

export const useProgressFeedback = () => {
  const { progressTracker } = useUserFeedback();
  return progressTracker;
};

export const useInteractionFeedback = () => {
  const { interactionState } = useUserFeedback();
  return interactionState;
};