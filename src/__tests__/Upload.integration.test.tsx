/**
 * Integration tests for Upload functionality (ConversionFlow component)
 * Tests file upload flow and error handling
 * **Validates: Requirements 2.1, 2.4, 6.1, 6.2**
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConversionFlow } from '@/components/conversion/ConversionFlow';
import { apiClient } from '@/lib/api';

// Mock API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    uploadFile: jest.fn(),
    initiatePayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    getOrder: jest.fn(),
    downloadOrder: jest.fn(),
  },
}));

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-blob-url'),
});

Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
});

describe('Upload Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();
    mockWindowOpen.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const renderConversionFlow = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ConversionFlow />
      </QueryClientProvider>
    );
  };

  const createMockFile = (name = 'test.pdf', type = 'application/pdf') => {
    return new File(['mock content'], name, { type });
  };

  describe('File Upload Flow', () => {
    it('should upload file using new API endpoint format (Requirements 2.1, 2.4)', async () => {
      // Mock successful upload response with new format
      const mockUploadResponse = {
        success: true,
        data: {
          upload_id: 'upload-123',
          order_id: 'order-456',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'File uploaded successfully',
      };

      (apiClient.uploadFile as jest.Mock).mockResolvedValue(mockUploadResponse);

      renderConversionFlow();

      // Verify initial state
      expect(screen.getByText('Upload do PDF')).toBeInTheDocument();
      expect(screen.getByText('Selecione um arquivo PDF')).toBeInTheDocument();

      // Select file
      const fileInput = screen.getByRole('button', {
        name: /selecionar arquivo pdf/i,
      });
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const mockFile = createMockFile();

      // Simulate file selection
      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      // Verify file is selected
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      // Click upload button
      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Verify API was called with correct file
      await waitFor(() => {
        expect(apiClient.uploadFile).toHaveBeenCalledWith(mockFile);
      });

      // Verify response handling with new format
      await waitFor(() => {
        expect(
          screen.getByText('Arquivo enviado! Iniciando pagamento...')
        ).toBeInTheDocument();
      });
    });

    it('should handle upload errors with new error format (Requirements 6.1, 6.2)', async () => {
      // Mock error response with new standardized format
      const mockErrorResponse = {
        success: false,
        error: 'UPLOAD_FAILED',
        message: 'File upload failed',
        details: {
          field_errors: {
            file: ['File size too large', 'Invalid file format'],
          },
          guidance: 'Please check file size and format',
        },
      };

      (apiClient.uploadFile as jest.Mock).mockRejectedValue(mockErrorResponse);

      renderConversionFlow();

      // Select file
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      // Click upload button
      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Verify error handling with new format
      await waitFor(() => {
        expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
        expect(screen.getByText(/Erro no upload/)).toBeInTheDocument();

        // Verify detailed error message includes field errors
        expect(screen.getByText(/File upload failed/)).toBeInTheDocument();
      });
    });

    it('should validate file type before upload', async () => {
      renderConversionFlow();

      // Try to select non-PDF file
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const invalidFile = createMockFile('test.txt', 'text/plain');

      Object.defineProperty(hiddenInput, 'files', {
        value: [invalidFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      // Verify error message for invalid file type (shown in status)
      await waitFor(() => {
        expect(
          screen.getByText('Erro na seleção do arquivo')
        ).toBeInTheDocument();
      });

      // Verify upload button is disabled (no file selected due to validation)
      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      expect(uploadButton).toBeDisabled();
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      const networkError = new Error(
        'Network error: Unable to connect to server'
      );
      (apiClient.uploadFile as jest.Mock).mockRejectedValue(networkError);

      renderConversionFlow();

      // Select valid file
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      // Click upload button
      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Verify network error handling
      await waitFor(() => {
        expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
        expect(screen.getByText(/Erro no upload/)).toBeInTheDocument();
        expect(
          screen.getByText('Network error: Unable to connect to server')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Payment Integration', () => {
    it('should handle new payment response format with checkout_url', async () => {
      // Mock successful upload
      const mockUploadResponse = {
        success: true,
        data: {
          upload_id: 'upload-123',
          order_id: 'order-456',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'File uploaded successfully',
      };

      // Mock payment response with new format
      const mockPaymentResponse = {
        success: true,
        data: {
          payment_id: 'payment-789',
          checkout_url: 'https://payment.example.com/checkout/789',
          qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
          amount: 5000,
          currency: 'BRL',
          expires_at: '2024-01-01T12:00:00Z',
        },
        message: 'Payment created successfully',
      };

      (apiClient.uploadFile as jest.Mock).mockResolvedValue(mockUploadResponse);
      (apiClient.initiatePayment as jest.Mock).mockResolvedValue(
        mockPaymentResponse
      );

      renderConversionFlow();

      // Upload file
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Wait for payment step
      await waitFor(() => {
        expect(
          screen.getByText('Confirmação de Pagamento')
        ).toBeInTheDocument();
      });

      // Click payment button
      const paymentButton = screen.getByRole('button', {
        name: /pagar com pix/i,
      });
      fireEvent.click(paymentButton);

      // Verify payment API was called
      await waitFor(() => {
        expect(apiClient.initiatePayment).toHaveBeenCalledWith(
          'order-456',
          expect.any(Object)
        );
      });

      // Verify new tab opened with checkout_url
      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          'https://payment.example.com/checkout/789',
          '_blank'
        );
      });

      // Verify waiting state
      await waitFor(() => {
        expect(screen.getByText('Aguardando Pagamento')).toBeInTheDocument();
        expect(
          screen.getByText('Complete o pagamento na aba do AbacatePay')
        ).toBeInTheDocument();
      });
    });

    it('should fallback to payment_url if checkout_url is not available', async () => {
      // Mock upload response
      const mockUploadResponse = {
        success: true,
        data: {
          upload_id: 'upload-123',
          order_id: 'order-456',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'File uploaded successfully',
      };

      // Mock payment response with old format (payment_url instead of checkout_url)
      const mockPaymentResponse = {
        success: true,
        data: {
          payment_id: 'payment-789',
          payment_url: 'https://payment.example.com/old/789',
          amount: 5000,
          currency: 'BRL',
        },
        message: 'Payment created successfully',
      };

      (apiClient.uploadFile as jest.Mock).mockResolvedValue(mockUploadResponse);
      (apiClient.initiatePayment as jest.Mock).mockResolvedValue(
        mockPaymentResponse
      );

      renderConversionFlow();

      // Upload file and trigger payment
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(
          screen.getByText('Confirmação de Pagamento')
        ).toBeInTheDocument();
      });

      const paymentButton = screen.getByRole('button', {
        name: /pagar com pix/i,
      });
      fireEvent.click(paymentButton);

      // Verify fallback to payment_url
      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          'https://payment.example.com/old/789',
          '_blank'
        );
      });
    });
  });

  describe('Error Recovery', () => {
    it('should allow starting new conversion after error', async () => {
      // Mock upload error
      const mockError = new Error('Upload failed');
      (apiClient.uploadFile as jest.Mock).mockRejectedValue(mockError);

      renderConversionFlow();

      // Upload file and trigger error
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
      });

      // Click try again button
      const retryButton = screen.getByRole('button', {
        name: /tentar novamente/i,
      });
      fireEvent.click(retryButton);

      // Verify back to initial state
      await waitFor(() => {
        expect(screen.getByText('Upload do PDF')).toBeInTheDocument();
        expect(
          screen.getByText('Selecione um arquivo PDF')
        ).toBeInTheDocument();
      });
    });

    it('should provide support contact option on error', async () => {
      // Mock upload error
      const mockError = new Error('Upload failed');
      (apiClient.uploadFile as jest.Mock).mockRejectedValue(mockError);

      renderConversionFlow();

      // Upload file and trigger error
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile();

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      fireEvent.click(uploadButton);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
      });

      // Verify support contact button exists
      const supportButton = screen.getByRole('button', {
        name: /contatar suporte/i,
      });
      expect(supportButton).toBeInTheDocument();

      // Click support button
      fireEvent.click(supportButton);

      // Verify mailto link opened
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'mailto:suporte@docfiscal.com',
        '_blank'
      );
    });
  });

  describe('File Display', () => {
    it('should display file information after selection', async () => {
      renderConversionFlow();

      // Select file
      const hiddenInput = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const mockFile = createMockFile('large-document.pdf', 'application/pdf');

      // Mock file size
      Object.defineProperty(mockFile, 'size', {
        value: 2048000, // 2MB
        writable: false,
      });

      Object.defineProperty(hiddenInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(hiddenInput);

      // Verify file information is displayed
      await waitFor(() => {
        expect(screen.getByText('large-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('1.95 MB')).toBeInTheDocument();
      });

      // Verify upload button is enabled
      const uploadButton = screen.getByRole('button', {
        name: /enviar pdf para conversão/i,
      });
      expect(uploadButton).not.toBeDisabled();
    });
  });
});
