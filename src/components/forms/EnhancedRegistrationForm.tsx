'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormValidator,
  ValidatedInput,
  useFormValidator,
  mapServerErrors,
  FormSuccess,
  type ValidationSchema,
  type ServerErrorMapping,
} from './FormValidator';
import type { RegisterData } from '@/types';

// Registration form data interface
interface RegistrationFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Validation schema for registration form
const registrationSchema: ValidationSchema<RegistrationFormData> = {
  fields: {
    fullName: {
      required: true,
      minLength: 2,
      maxLength: 100,
      customValidator: (value: string) => {
        if (!value || value.trim().length < 2) {
          return 'Full name must be at least 2 characters long';
        }
        if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value.trim())) {
          return 'Full name can only contain letters, spaces, hyphens, and apostrophes';
        }
        return null;
      },
    },
    email: {
      required: true,
      type: 'email',
      customValidator: (value: string) => {
        if (!value) return null;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      },
    },
    password: {
      required: true,
      minLength: 6,
      customValidator: (value: string) => {
        if (!value) return null;
        if (value.length < 6) {
          return 'Password must be at least 6 characters long';
        }
        if (!/[a-zA-Z]/.test(value)) {
          return 'Password must contain at least one letter';
        }
        return null;
      },
    },
    confirmPassword: {
      required: true,
      customValidator: (value: string, formData?: Record<string, any>) => {
        if (!value) return 'Please confirm your password';
        if (formData && value !== formData.password) {
          return 'Passwords do not match';
        }
        return null;
      },
    },
  },
  customValidators: [
    (formData: RegistrationFormData) => {
      const errors = [];
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        errors.push({
          field: 'confirmPassword',
          message: 'Passwords do not match',
        });
      }
      return errors;
    },
  ],
};

// Server error mapping for user-friendly messages
const serverErrorMapping: ServerErrorMapping = {
  'EMAIL_ALREADY_EXISTS': {
    field: 'email',
    message: 'An account with this email already exists',
  },
  'INVALID_EMAIL': {
    field: 'email',
    message: 'Please enter a valid email address',
  },
  'WEAK_PASSWORD': {
    field: 'password',
    message: 'Password is too weak. Please choose a stronger password',
  },
  'INVALID_NAME': {
    field: 'fullName',
    message: 'Please enter a valid full name',
  },
  'REGISTRATION_FAILED': {
    field: 'general',
    message: 'Registration failed. Please try again',
  },
  'SERVER_ERROR': {
    field: 'general',
    message: 'Server error. Please try again later',
  },
};

// Internal form component that uses the validator context
const RegistrationFormContent: React.FC = () => {
  const [formData, setFormData] = useState<RegistrationFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const router = useRouter();

  const { validateForm, focusFirstError, clearErrors } = useFormValidator();

  const handleInputChange = (field: keyof RegistrationFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear server errors when user starts typing
    if (serverErrors.length > 0) {
      setServerErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setServerErrors([]);
    setSuccessMessage('');
    clearErrors();

    // Validate form
    const validationResult = validateForm(formData);
    
    if (!validationResult.isValid) {
      setIsLoading(false);
      focusFirstError();
      return;
    }

    try {
      // Register the user using apiClient
      const registerResponse = await apiClient.register({
        name: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      if (!registerResponse.success) {
        // Map server errors to user-friendly messages
        const mappedErrors = mapServerErrors(
          registerResponse.error || registerResponse.message,
          serverErrorMapping
        );
        
        // Set server errors for display
        setServerErrors(mappedErrors.map(e => e.message));
        return;
      }

      // Show success message
      setSuccessMessage('Account created successfully! Logging you in...');

      // Auto-login after successful registration
      const loginResponse = await apiClient.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (!loginResponse.success) {
        setSuccessMessage('Account created successfully! Please log in manually.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof Error) {
        setServerErrors([error.message]);
      } else {
        setServerErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="register-title">
      <ValidatedInput
        fieldName="fullName"
        label="Full Name"
        type="text"
        placeholder="Enter your full name"
        value={formData.fullName}
        onChange={handleInputChange('fullName')}
        disabled={isLoading}
        autoComplete="name"
        required
      />

      <ValidatedInput
        fieldName="email"
        label="Email"
        type="email"
        placeholder="Enter your email"
        value={formData.email}
        onChange={handleInputChange('email')}
        disabled={isLoading}
        autoComplete="email"
        required
      />

      <ValidatedInput
        fieldName="password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={formData.password}
        onChange={handleInputChange('password')}
        disabled={isLoading}
        autoComplete="new-password"
        required
      />

      <ValidatedInput
        fieldName="confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Confirm your password"
        value={formData.confirmPassword}
        onChange={handleInputChange('confirmPassword')}
        disabled={isLoading}
        autoComplete="new-password"
        required
      />

      {/* Server errors display */}
      {serverErrors.length > 0 && (
        <div className="space-y-1">
          {serverErrors.map((error, index) => (
            <div
              key={index}
              className="text-red-600 text-sm text-center"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          ))}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <FormSuccess
          message={successMessage}
          onDismiss={() => setSuccessMessage('')}
          autoHide={false}
        />
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
};

// Main component with FormValidator wrapper
export default function EnhancedRegistrationForm() {
  const [isValid, setIsValid] = useState(false);

  const handleValidationChange = (valid: boolean) => {
    setIsValid(valid);
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8"
      role="main"
    >
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle
            className="text-2xl font-bold text-center"
            id="register-title"
          >
            Create account
          </CardTitle>
          <CardDescription className="text-center">
            Enter your information to create a new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormValidator
            schema={registrationSchema}
            onValidationChange={handleValidationChange}
          >
            <RegistrationFormContent />
          </FormValidator>
          
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// Export for testing
export { registrationSchema, serverErrorMapping, type RegistrationFormData };