'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { z } from 'zod';

// Types for form validation
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  firstErrorField?: string;
}

export interface FieldValidator {
  required?: boolean;
  type?: 'email' | 'password' | 'text' | 'file';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any, formData?: Record<string, any>) => string | null;
}

export interface ValidationSchema<T> {
  fields: Record<keyof T, FieldValidator>;
  customValidators?: Array<(formData: T) => ValidationError[]>;
}

export interface FormValidatorContextType {
  errors: ValidationError[];
  isValid: boolean;
  validateField: (fieldName: string, value: any, formData?: Record<string, any>) => void;
  validateForm: (formData: Record<string, any>) => ValidationResult;
  clearErrors: () => void;
  clearFieldError: (fieldName: string) => void;
  getFieldError: (fieldName: string) => string | undefined;
  hasFieldError: (fieldName: string) => boolean;
  focusFirstError: () => void;
}

const FormValidatorContext = createContext<FormValidatorContextType | null>(null);

export interface FormValidatorProps<T> {
  schema: ValidationSchema<T>;
  onValidationChange?: (isValid: boolean, errors: ValidationError[]) => void;
  children: React.ReactNode;
}

export function FormValidator<T extends Record<string, any>>({
  schema,
  onValidationChange,
  children,
}: FormValidatorProps<T>) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState(true);
  const fieldRefs = useRef<Record<string, HTMLElement>>({});

  const validateSingleField = useCallback((
    fieldName: string,
    value: any,
    fieldValidator: FieldValidator,
    formData?: Record<string, any>
  ): string | null => {
    // Required validation
    if (fieldValidator.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${fieldName} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    // Type-specific validation
    if (fieldValidator.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Please enter a valid email address';
      }
    }

    // Length validation
    if (fieldValidator.minLength && value.length < fieldValidator.minLength) {
      return `${fieldName} must be at least ${fieldValidator.minLength} characters long`;
    }

    if (fieldValidator.maxLength && value.length > fieldValidator.maxLength) {
      return `${fieldName} must be no more than ${fieldValidator.maxLength} characters long`;
    }

    // Pattern validation
    if (fieldValidator.pattern && !fieldValidator.pattern.test(value)) {
      return `${fieldName} format is invalid`;
    }

    // Custom validation
    if (fieldValidator.customValidator) {
      return fieldValidator.customValidator(value, formData);
    }

    return null;
  }, []);

  const validateField = useCallback((fieldName: string, value: any, formData?: Record<string, any>) => {
    const fieldValidator = schema.fields[fieldName as keyof T];
    if (!fieldValidator) return;

    const error = validateSingleField(fieldName, value, fieldValidator, formData);
    
    setErrors(prevErrors => {
      const filteredErrors = prevErrors.filter(e => e.field !== fieldName);
      const newErrors = error ? [...filteredErrors, { field: fieldName, message: error }] : filteredErrors;
      
      const newIsValid = newErrors.length === 0;
      setIsValid(newIsValid);
      
      if (onValidationChange) {
        onValidationChange(newIsValid, newErrors);
      }
      
      return newErrors;
    });
  }, [schema.fields, validateSingleField, onValidationChange]);

  const validateForm = useCallback((formData: Record<string, any>): ValidationResult => {
    const fieldErrors: ValidationError[] = [];
    let firstErrorField: string | undefined;

    // Validate individual fields
    Object.entries(schema.fields).forEach(([fieldName, fieldValidator]) => {
      const value = formData[fieldName];
      const error = validateSingleField(fieldName, value, fieldValidator, formData);
      
      if (error) {
        fieldErrors.push({ field: fieldName, message: error });
        if (!firstErrorField) {
          firstErrorField = fieldName;
        }
      }
    });

    // Run custom form-level validators
    if (schema.customValidators) {
      schema.customValidators.forEach(validator => {
        const customErrors = validator(formData as T);
        fieldErrors.push(...customErrors);
        if (!firstErrorField && customErrors.length > 0) {
          firstErrorField = customErrors[0].field;
        }
      });
    }

    const result: ValidationResult = {
      isValid: fieldErrors.length === 0,
      errors: fieldErrors,
      firstErrorField,
    };

    setErrors(fieldErrors);
    setIsValid(result.isValid);
    
    if (onValidationChange) {
      onValidationChange(result.isValid, fieldErrors);
    }

    return result;
  }, [schema, validateSingleField, onValidationChange]);

  const clearErrors = useCallback(() => {
    setErrors([]);
    setIsValid(true);
    if (onValidationChange) {
      onValidationChange(true, []);
    }
  }, [onValidationChange]);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prevErrors => {
      const newErrors = prevErrors.filter(e => e.field !== fieldName);
      const newIsValid = newErrors.length === 0;
      setIsValid(newIsValid);
      
      if (onValidationChange) {
        onValidationChange(newIsValid, newErrors);
      }
      
      return newErrors;
    });
  }, [onValidationChange]);

  const getFieldError = useCallback((fieldName: string): string | undefined => {
    const error = errors.find(e => e.field === fieldName);
    return error?.message;
  }, [errors]);

  const hasFieldError = useCallback((fieldName: string): boolean => {
    return errors.some(e => e.field === fieldName);
  }, [errors]);

  const focusFirstError = useCallback(() => {
    if (errors.length > 0) {
      const firstErrorField = errors[0].field;
      const element = fieldRefs.current[firstErrorField];
      if (element && 'focus' in element) {
        (element as HTMLInputElement).focus();
      }
    }
  }, [errors]);

  // Register field refs for focus management
  const registerFieldRef = useCallback((fieldName: string, element: HTMLElement | null) => {
    if (element) {
      fieldRefs.current[fieldName] = element;
    } else {
      delete fieldRefs.current[fieldName];
    }
  }, []);

  const contextValue: FormValidatorContextType = {
    errors,
    isValid,
    validateField,
    validateForm,
    clearErrors,
    clearFieldError,
    getFieldError,
    hasFieldError,
    focusFirstError,
  };

  return (
    <FormValidatorContext.Provider value={contextValue}>
      <FormValidatorProvider registerFieldRef={registerFieldRef}>
        {children}
      </FormValidatorProvider>
    </FormValidatorContext.Provider>
  );
}

// Internal provider for field registration
interface FormValidatorProviderProps {
  registerFieldRef: (fieldName: string, element: HTMLElement | null) => void;
  children: React.ReactNode;
}

const FormValidatorProvider: React.FC<FormValidatorProviderProps> = ({ registerFieldRef, children }) => {
  return (
    <FormValidatorRefContext.Provider value={registerFieldRef}>
      {children}
    </FormValidatorRefContext.Provider>
  );
};

const FormValidatorRefContext = createContext<((fieldName: string, element: HTMLElement | null) => void) | null>(null);

export function useFormValidator() {
  const context = useContext(FormValidatorContext);
  if (!context) {
    throw new Error('useFormValidator must be used within a FormValidator');
  }
  return context;
}

export function useFieldRef() {
  const context = useContext(FormValidatorRefContext);
  if (!context) {
    throw new Error('useFieldRef must be used within a FormValidator');
  }
  return context;
}

// Enhanced Input component with validation
export interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  fieldName: string;
  label?: string;
  showError?: boolean;
  preserveValue?: boolean;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  fieldName,
  label,
  showError = true,
  preserveValue = true,
  className = '',
  onChange,
  onBlur,
  ...props
}) => {
  const { getFieldError, hasFieldError, validateField, clearFieldError } = useFormValidator();
  const registerFieldRef = useFieldRef();
  const [value, setValue] = useState(props.value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerFieldRef(fieldName, inputRef.current);
    return () => registerFieldRef(fieldName, null);
  }, [fieldName, registerFieldRef]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (preserveValue) {
      setValue(newValue);
    }
    
    // Clear field error on change to provide immediate feedback
    if (hasFieldError(fieldName)) {
      clearFieldError(fieldName);
    }
    
    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Validate field on blur
    validateField(fieldName, e.target.value);
    
    if (onBlur) {
      onBlur(e);
    }
  };

  const error = getFieldError(fieldName);
  const hasError = hasFieldError(fieldName);

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={fieldName} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        {...props}
        ref={inputRef}
        id={fieldName}
        name={fieldName}
        value={preserveValue ? value : props.value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
          ${hasError 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500'
          }
          ${className}
        `}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${fieldName}-error` : undefined}
      />
      {showError && error && (
        <div
          id={`${fieldName}-error`}
          className="text-red-600 text-sm"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
};

// Server error mapping utility
export interface ServerErrorMapping {
  [serverErrorCode: string]: {
    field?: string;
    message: string;
  };
}

export const mapServerErrors = (
  serverErrors: any,
  mapping: ServerErrorMapping
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (!serverErrors && serverErrors !== '') {
    return errors;
  }
  
  if (typeof serverErrors === 'string') {
    // Single error message (including empty string)
    errors.push({ field: 'general', message: serverErrors });
  } else if (Array.isArray(serverErrors)) {
    // Array of errors
    serverErrors.forEach(error => {
      if (typeof error === 'string') {
        errors.push({ field: 'general', message: error });
      } else if (error && typeof error === 'object') {
        const errorCode = error.code;
        if (errorCode && Object.prototype.hasOwnProperty.call(mapping, errorCode)) {
          const mapped = mapping[errorCode];
          errors.push({
            field: mapped.field || 'general',
            message: mapped.message,
          });
        } else {
          errors.push({
            field: error.field || 'general',
            message: error.message || 'An error occurred',
          });
        }
      }
    });
  } else if (serverErrors && typeof serverErrors === 'object') {
    // Object with field-specific errors or single error object
    if (serverErrors.code) {
      // Single error object with code
      const errorCode = serverErrors.code;
      if (Object.prototype.hasOwnProperty.call(mapping, errorCode)) {
        const mapped = mapping[errorCode];
        errors.push({
          field: mapped.field || 'general',
          message: mapped.message,
        });
      } else {
        errors.push({
          field: serverErrors.field || 'general',
          message: serverErrors.message || 'An error occurred',
        });
      }
    } else {
      // Field-specific errors object
      Object.entries(serverErrors).forEach(([field, message]) => {
        errors.push({
          field,
          message: typeof message === 'string' ? message : 'Invalid value',
        });
      });
    }
  }
  
  return errors;
};

// Success confirmation component
export interface FormSuccessProps {
  message: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const FormSuccess: React.FC<FormSuccessProps> = ({
  message,
  onDismiss,
  autoHide = true,
  duration = 5000,
}) => {
  useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);

  return (
    <div
      className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg
            className="w-5 h-5 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>{message}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-600 hover:text-green-800 focus:outline-none"
            aria-label="Dismiss success message"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};