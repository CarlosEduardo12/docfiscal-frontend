import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ErrorBoundary,
  useErrorHandler,
} from '@/components/error/ErrorBoundary';
import {
  classifyError,
  logError,
  AppError,
  ErrorType,
  ErrorSeverity,
} from '@/lib/error-handling';

// Test component that throws errors
const ErrorThrowingComponent = ({
  shouldThrow,
  errorMessage,
}: {
  shouldThrow: boolean;
  errorMessage?: string;
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage || 'Test error');
  }
  return (
    <div data-testid="success-component">Component rendered successfully</div>
  );
};

// Test component that uses error handler hook
const ErrorHandlerTestComponent = () => {
  const { reportError } = useErrorHandler();

  const handleClick = () => {
    reportError(new Error('Manual error report'), 'Button click');
  };

  return (
    <button onClick={handleClick} data-testid="error-button">
      Report Error
    </button>
  );
};

describe('Error Handling', () => {
  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock console methods
  const originalConsoleError = console.error;
  const mockConsoleError = jest.fn();

  beforeEach(() => {
    console.error = mockConsoleError;
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('ErrorBoundary Component', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('success-component')).toBeInTheDocument();
    });

    it('catches and displays error when child component throws', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent
            shouldThrow={true}
            errorMessage="Test component error"
          />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(
        screen.getByText(/we encountered an unexpected error/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /try again/i })
      ).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ErrorThrowingComponent
            shouldThrow={true}
            errorMessage="Detailed error message"
          />
        </ErrorBoundary>
      );

      expect(screen.getByText(/error details/i)).toBeInTheDocument();
      expect(screen.getByText('Detailed error message')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('provides retry functionality', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      // The retry button should be clickable
      fireEvent.click(retryButton);

      // After clicking retry, the error boundary should reset its state
      // Note: In a real scenario, this would re-render the child component
    });

    it('provides reset functionality', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const resetButton = screen.getByRole('button', {
        name: /reset component/i,
      });
      expect(resetButton).toBeInTheDocument();

      fireEvent.click(resetButton);
      // Reset should clear the error state
    });

    it('provides go home functionality', () => {
      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const homeButton = screen.getByRole('button', {
        name: /go to homepage/i,
      });
      expect(homeButton).toBeInTheDocument();

      // The button should be clickable
      fireEvent.click(homeButton);

      // In a real scenario, this would navigate to the homepage
    });

    it('calls custom error handler when provided', () => {
      const mockOnError = jest.fn();

      render(
        <ErrorBoundary onError={mockOnError}>
          <ErrorThrowingComponent
            shouldThrow={true}
            errorMessage="Custom handler test"
          />
        </ErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Custom handler test' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('stores error information in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      render(
        <ErrorBoundary>
          <ErrorThrowingComponent
            shouldThrow={true}
            errorMessage="Storage test error"
          />
        </ErrorBoundary>
      );

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'docfiscal-errors',
        expect.stringContaining('Storage test error')
      );
    });

    it('limits stored errors to 10 entries', () => {
      const existingErrors = Array.from({ length: 10 }, (_, i) => ({
        message: `Error ${i}`,
        timestamp: new Date().toISOString(),
      }));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingErrors));

      render(
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorMessage="New error" />
        </ErrorBoundary>
      );

      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const storedErrors = JSON.parse(setItemCall[1]);
      expect(storedErrors).toHaveLength(10);
      expect(storedErrors[9].message).toBe('New error');
    });
  });

  describe('useErrorHandler Hook', () => {
    it('provides reportError function', () => {
      render(<ErrorHandlerTestComponent />);

      const button = screen.getByTestId('error-button');
      expect(button).toBeInTheDocument();
    });

    it('reports errors to localStorage', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      render(<ErrorHandlerTestComponent />);

      const button = screen.getByTestId('error-button');
      fireEvent.click(button);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'docfiscal-errors',
        expect.stringContaining('Manual error report')
      );
    });
  });

  describe('Error Classification', () => {
    it('classifies network errors correctly', () => {
      const networkError = new Error('Failed to fetch');
      const classified = classifyError(networkError);

      expect(classified.type).toBe(ErrorType.NETWORK);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('classifies validation errors correctly', () => {
      const validationError = new Error('invalid input provided');
      const classified = classifyError(validationError);

      expect(classified.type).toBe(ErrorType.VALIDATION);
      expect(classified.severity).toBe(ErrorSeverity.LOW);
    });

    it('classifies authentication errors correctly', () => {
      const authError = new Error('unauthorized access');
      const classified = classifyError(authError);

      expect(classified.type).toBe(ErrorType.AUTHENTICATION);
      expect(classified.severity).toBe(ErrorSeverity.HIGH);
    });

    it('handles unknown errors as generic type', () => {
      const unknownError = new Error('Something unexpected happened');
      const classified = classifyError(unknownError);

      expect(classified.type).toBe(ErrorType.UNKNOWN);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('Error Creation', () => {
    it('creates app error with all required fields', () => {
      const appError = new AppError(
        'Test error message',
        ErrorType.VALIDATION,
        ErrorSeverity.LOW,
        { field: 'email' },
        true
      );

      expect(appError.message).toBe('Test error message');
      expect(appError.type).toBe(ErrorType.VALIDATION);
      expect(appError.severity).toBe(ErrorSeverity.LOW);
      expect(appError.context).toEqual({ field: 'email' });
      expect(appError.retryable).toBe(true);
      expect(appError.timestamp).toBeInstanceOf(Date);
      expect(appError.errorId).toBeDefined();
    });
  });

  describe('Error Logging', () => {
    it('logs errors to console', () => {
      const mockConsoleWarn = jest.fn();
      console.warn = mockConsoleWarn;

      const appError = new AppError(
        'Test log error',
        ErrorType.UNKNOWN,
        ErrorSeverity.MEDIUM
      );
      logError(appError, 'Test context');

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'MEDIUM SEVERITY ERROR:',
        expect.objectContaining({
          message: 'Test log error',
          context: 'Test context',
        })
      );
    });
  });
});
