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
import type { LoginCredentials } from '@/types';

// Login form data interface
interface LoginFormData {
  email: string;
  password: string;
}

// Validation schema for login form
const loginSchema: ValidationSchema<LoginFormData> = {
  fields: {
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
      minLength: 1,
      customValidator: (value: string) => {
        if (!value || value.trim() === '') {
          return 'Password is required';
        }
        return null;
      },
    },
  },
};

// Server error mapping for user-friendly messages
const serverErrorMapping: ServerErrorMapping = {
  'INVALID_CREDENTIALS': {
    field: 'general',
    message: 'Invalid email or password. Please check your credentials and try again.',
  },
  'USER_NOT_FOUND': {
    field: 'email',
    message: 'No account found with this email address',
  },
  'INVALID_PASSWORD': {
    field: 'password',
    message: 'Incorrect password. Please try again.',
  },
  'ACCOUNT_LOCKED': {
    field: 'general',
    message: 'Account temporarily locked due to multiple failed attempts. Please try again later.',
  },
  'EMAIL_NOT_VERIFIED': {
    field: 'general',
    message: 'Please verify your email address before logging in',
  },
  'LOGIN_FAILED': {
    field: 'general',
    message: 'Login failed. Please try again',
  },
  'SERVER_ERROR': {
    field: 'general',
    message: 'Server error. Please try again later',
  },
  'NETWORK_ERROR': {
    field: 'general',
    message: 'Network error. Please check your connection and try again',
  },
};

// Internal form component that uses the validator context
const LoginFormContent: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const router = useRouter();

  const { validateForm, focusFirstError, clearErrors } = useFormValidator();

  const handleInputChange = (field: keyof LoginFormData) => (
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
      const result = await apiClient.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (!result.success) {
        // Map server errors to user-friendly messages
        const mappedErrors = mapServerErrors(
          result.error || result.message,
          serverErrorMapping
        );
        
        // Set server errors for display
        setServerErrors(mappedErrors.map(e => e.message));
        return;
      }

      // Show success message
      setSuccessMessage('Login successful! Redirecting to dashboard...');
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          setServerErrors(['Network error. Please check your connection and try again.']);
        } else {
          setServerErrors([error.message]);
        }
      } else {
        setServerErrors(['An unexpected error occurred. Please try again.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="login-title">
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
        autoComplete="current-password"
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
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
};

// Main component with FormValidator wrapper
export default function EnhancedLoginForm() {
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
            id="login-title"
          >
            Sign in
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormValidator
            schema={loginSchema}
            onValidationChange={handleValidationChange}
          >
            <LoginFormContent />
          </FormValidator>
          
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// Export for testing
export { loginSchema, serverErrorMapping, type LoginFormData };