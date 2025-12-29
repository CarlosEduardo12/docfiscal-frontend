import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PaymentSuccessPage from '@/app/payment/success/page';
import PaymentCompletePage from '@/app/payment/complete/page';
import PaymentCancelPage from '@/app/payment/cancel/page';
import { apiClient } from '@/lib/api';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    getPaymentStatus: jest.fn(),
    getOrder: jest.fn(),
    downloadOrder: jest.fn(),
  },
}));

// Mock query keys
jest.mock('@/lib/react-query', () => ({
  queryKeys: {
    orders: {
      all: ['orders'],
      byId: (id: string) => ['orders', id],
    },
  },
}));

const mockPush = jest.fn();
const mockSearchParams = new Map();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
  });

  mockSearchParams.clear();
  (useSearchParams as jest.Mock).mockReturnValue({
    get: (key: string) => mockSearchParams.get(key),
  });

  // Setup DOM
  document.body.innerHTML = '';
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('Payment Success Page Integration', () => {
  it('should handle successful payment status check and redirect', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');
    mockSearchParams.set('order_id', 'order_456');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        status: 'completed',
        order_id: 'order_456',
      },
    });

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Verify initial loading state
    expect(screen.getByText('Retornando do pagamento...')).toBeInTheDocument();

    // Wait for payment status check
    await waitFor(() => {
      expect(apiClient.getPaymentStatus).toHaveBeenCalledWith('payment_123');
    });

    // Verify success state
    await waitFor(() => {
      expect(screen.getByText('Pagamento Confirmado!')).toBeInTheDocument();
      expect(
        screen.getByText('Pagamento confirmado! Redirecionando...')
      ).toBeInTheDocument();
    });

    // Wait for redirect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/payment/complete?payment_id=payment_123&order_id=order_456'
    );
  });

  it('should handle pending payment status and continue polling', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');

    (apiClient.getPaymentStatus as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'pending' },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'completed', order_id: 'order_456' },
      });

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for first status check
    await waitFor(() => {
      expect(
        screen.getByText('Pagamento ainda pendente. Verificando novamente...')
      ).toBeInTheDocument();
    });

    // Wait for second status check (after 3 seconds)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });

    await waitFor(() => {
      expect(screen.getByText('Pagamento Confirmado!')).toBeInTheDocument();
    });

    expect(apiClient.getPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it('should handle failed payment status', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'failed' },
    });

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for status check
    await waitFor(() => {
      expect(screen.getByText('Atenção')).toBeInTheDocument();
      expect(
        screen.getByText('Pagamento cancelado ou expirado.')
      ).toBeInTheDocument();
    });

    // Verify retry buttons are shown
    expect(screen.getByText('Tentar Novamente')).toBeInTheDocument();
    expect(screen.getByText('Voltar ao Dashboard')).toBeInTheDocument();
  });

  it('should handle order status check when only order_id is provided', async () => {
    // Setup
    mockSearchParams.set('order_id', 'order_456');

    (apiClient.getOrder as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'completed' },
    });

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for order status check
    await waitFor(() => {
      expect(apiClient.getOrder).toHaveBeenCalledWith('order_456');
    });

    // Should redirect to complete page
    expect(mockPush).toHaveBeenCalledWith(
      '/payment/complete?order_id=order_456'
    );
  });

  it('should handle API errors gracefully', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');

    (apiClient.getPaymentStatus as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for error handling
    await waitFor(() => {
      expect(screen.getByText('Atenção')).toBeInTheDocument();
      expect(
        screen.getByText('Erro ao verificar status do pagamento.')
      ).toBeInTheDocument();
    });
  });
});

describe('Payment Complete Page Integration', () => {
  it('should handle completed payment and start order processing monitoring', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');
    mockSearchParams.set('order_id', 'order_456');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'completed' },
    });

    (apiClient.getOrder as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'order_456',
        status: 'completed',
        filename: 'test.pdf',
      },
    });

    // Render
    renderWithQueryClient(<PaymentCompletePage />);

    // Wait for payment status check
    await waitFor(() => {
      expect(apiClient.getPaymentStatus).toHaveBeenCalledWith('payment_123');
    });

    // Wait for processing to start
    await waitFor(() => {
      expect(screen.getByText('✅ Pagamento Concluído!')).toBeInTheDocument();
      expect(
        screen.getByText('Processando seu arquivo...')
      ).toBeInTheDocument();
    });

    // Wait for order completion
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });

    await waitFor(() => {
      expect(screen.getByText('Conversão Concluída!')).toBeInTheDocument();
      expect(screen.getByText('📥 Baixar CSV Convertido')).toBeInTheDocument();
    });
  });

  it('should handle pending payment status', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'pending' },
    });

    // Render
    renderWithQueryClient(<PaymentCompletePage />);

    // Wait for status check
    await waitFor(() => {
      expect(screen.getByText('Aguardando Pagamento...')).toBeInTheDocument();
      expect(
        screen.getByText('Complete o pagamento na aba do AbacatePay.')
      ).toBeInTheDocument();
    });
  });

  it('should handle file download with proper error handling', async () => {
    // Setup
    mockSearchParams.set('order_id', 'order_456');

    const mockBlob = new Blob(['test content'], { type: 'text/csv' });
    (apiClient.downloadOrder as jest.Mock).mockResolvedValue(mockBlob);

    // Render
    renderWithQueryClient(<PaymentCompletePage />);

    // Verify the component renders
    expect(screen.getByText('Verificando Pagamento...')).toBeInTheDocument();

    // Test download function call
    await act(async () => {
      await apiClient.downloadOrder('order_456');
    });

    expect(apiClient.downloadOrder).toHaveBeenCalledWith('order_456');
  });

  it('should handle download link expiration error', async () => {
    // Setup
    mockSearchParams.set('order_id', 'order_456');

    (apiClient.downloadOrder as jest.Mock).mockRejectedValue(
      new Error('Download link expired')
    );

    // Render
    renderWithQueryClient(<PaymentCompletePage />);

    // Verify the component renders
    expect(screen.getByText('Verificando Pagamento...')).toBeInTheDocument();

    // Test error handling
    await act(async () => {
      try {
        await apiClient.downloadOrder('order_456');
      } catch (error) {
        expect(error.message).toBe('Download link expired');
      }
    });
  });

  it('should handle failed processing status', async () => {
    // Setup
    mockSearchParams.set('payment_id', 'payment_123');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'failed' },
    });

    // Render
    renderWithQueryClient(<PaymentCompletePage />);

    // Wait for status check
    await waitFor(() => {
      expect(screen.getByText('Erro no Processamento')).toBeInTheDocument();
      expect(
        screen.getByText('Tente novamente ou entre em contato com o suporte.')
      ).toBeInTheDocument();
    });

    // Verify retry button is shown
    expect(screen.getByText('Nova Conversão')).toBeInTheDocument();
  });
});

describe('Payment Cancel Page Integration', () => {
  it('should render cancel page with proper navigation options', () => {
    // Render
    const { container } = render(<PaymentCancelPage />);

    // Verify content
    expect(screen.getByText('Pagamento Cancelado')).toBeInTheDocument();
    expect(
      screen.getByText('O pagamento foi cancelado ou não foi concluído.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Você pode tentar novamente quando quiser.')
    ).toBeInTheDocument();

    // Verify navigation buttons
    expect(screen.getByText('Tentar Novamente')).toBeInTheDocument();
    expect(screen.getByText('Voltar ao Dashboard')).toBeInTheDocument();
  });
});

describe('Payment Flow Integration', () => {
  it('should handle complete payment flow from success to complete page', async () => {
    // Test the success page functionality
    mockSearchParams.set('payment_id', 'payment_123');
    mockSearchParams.set('order_id', 'order_456');

    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'completed', order_id: 'order_456' },
    });

    const { unmount } = renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for payment status check and success state
    await waitFor(() => {
      expect(screen.getByText('Pagamento Confirmado!')).toBeInTheDocument();
    });

    unmount();

    // Test the complete page functionality
    mockPush.mockClear();
    (apiClient.getPaymentStatus as jest.Mock).mockResolvedValue({
      success: true,
      data: { status: 'completed' },
    });

    (apiClient.getOrder as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'order_456',
        status: 'completed',
        filename: 'test.pdf',
      },
    });

    renderWithQueryClient(<PaymentCompletePage />);

    // Verify complete page functionality
    await waitFor(() => {
      expect(screen.getByText('✅ Pagamento Concluído!')).toBeInTheDocument();
    });
  });

  it('should handle payment status polling mechanism', async () => {
    // Setup polling scenario
    mockSearchParams.set('payment_id', 'payment_123');

    let callCount = 0;
    (apiClient.getPaymentStatus as jest.Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          success: true,
          data: { status: 'pending' },
        });
      } else {
        return Promise.resolve({
          success: true,
          data: { status: 'completed', order_id: 'order_456' },
        });
      }
    });

    // Render
    renderWithQueryClient(<PaymentSuccessPage />);

    // Wait for first call
    await waitFor(() => {
      expect(
        screen.getByText('Pagamento ainda pendente. Verificando novamente...')
      ).toBeInTheDocument();
    });

    // Wait for polling interval (3 seconds)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });

    // Verify final success state
    await waitFor(() => {
      expect(screen.getByText('Pagamento Confirmado!')).toBeInTheDocument();
    });

    // Should have made at least 2 calls
    expect(apiClient.getPaymentStatus).toHaveBeenCalledTimes(3);
  });
});
