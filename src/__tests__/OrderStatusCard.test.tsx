import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderStatusCard } from '@/components/order/OrderStatusCard';
import type { Order } from '@/types';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
}));

// Mock window.open
Object.defineProperty(window, 'open', {
  writable: true,
  value: jest.fn(),
});

// Mock order data for testing
const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-123',
  user_id: 'user-456',
  filename: 'test-document.pdf',
  file_size: 1024 * 1024, // 1MB
  status: 'pending_payment',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  // Legacy fields for backward compatibility
  originalFileSize: 1024 * 1024,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

// Helper function to render components with QueryClient provider
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('OrderStatusCard Component', () => {
  const mockOnPaymentClick = jest.fn();
  const mockOnDownloadClick = jest.fn();

  beforeEach(() => {
    mockOnPaymentClick.mockClear();
    mockOnDownloadClick.mockClear();
  });

  it('renders pending payment status correctly', () => {
    const order = createMockOrder({
      status: 'pending_payment',
      checkout_url: 'https://mercadopago.com/payment/123',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Pending Payment')).toBeInTheDocument();
    expect(
      screen.getByText(/complete payment to start processing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /complete payment/i })
    ).toBeInTheDocument();
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
  });

  it('renders processing status with loading indicator', () => {
    const order = createMockOrder({ status: 'processing' });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(
      screen.getByText(/your document is being converted/i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(2); // Status badge and message
  });

  it('renders completed status with download button', () => {
    const order = createMockOrder({
      status: 'completed',
      download_url: 'https://api.docfiscal.com/download/123',
      processing_completed_at: '2024-01-01T10:05:00Z',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(
      screen.getByText(/your csv file is ready for download/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download csv/i })
    ).toBeInTheDocument();
  });

  it('renders failed status with error message', () => {
    const order = createMockOrder({
      status: 'failed',
      error_message: 'Unable to process the PDF file',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
    expect(
      screen.getByText('Unable to process the PDF file')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try again/i })
    ).toBeInTheDocument();
  });

  it('calls onPaymentClick when pay button is clicked and no checkout_url', () => {
    const order = createMockOrder({
      status: 'pending_payment',
      checkout_url: undefined, // No URL, so callback should be called
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    const payButton = screen.getByRole('button', { name: /complete payment/i });
    fireEvent.click(payButton);

    expect(mockOnPaymentClick).toHaveBeenCalledTimes(1);
  });

  it('calls onDownloadClick when download button is clicked and no download_url', () => {
    const order = createMockOrder({
      status: 'completed',
      download_url: undefined, // No URL, so callback should be called
      processing_completed_at: '2024-01-01T10:05:00Z',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    const downloadButton = screen.getByRole('button', {
      name: /download csv/i,
    });
    fireEvent.click(downloadButton);

    expect(mockOnDownloadClick).toHaveBeenCalledTimes(1);
  });

  it('displays order creation date', () => {
    const order = createMockOrder({
      created_at: '2024-01-15T14:30:00Z',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    // Check that some form of date is displayed
    expect(screen.getByText(/january|jan/i)).toBeInTheDocument();
  });

  it('displays file size information', () => {
    const order = createMockOrder({
      file_size: 2.5 * 1024 * 1024, // 2.5MB
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('2.50 MB')).toBeInTheDocument();
  });

  it('handles paid status correctly', () => {
    const order = createMockOrder({ status: 'paid' });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Payment Confirmed')).toBeInTheDocument();
    expect(screen.getByText(/payment received/i)).toBeInTheDocument();
  });

  it('shows order ID for reference', () => {
    const order = createMockOrder({ id: 'ORD-12345' });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText(/ORD-12345/)).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const order = createMockOrder({
      status: 'failed',
      error_message: undefined, // Missing error message
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
    // Should not crash when error_message is undefined
  });

  it('handles new checkout_url format correctly', () => {
    const order = createMockOrder({
      status: 'pending_payment',
      checkout_url: 'https://payment.provider.com/checkout/abc123',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    const payButton = screen.getByRole('button', { name: /complete payment/i });
    fireEvent.click(payButton);

    // Should not call the callback since checkout_url is provided
    expect(mockOnPaymentClick).not.toHaveBeenCalled();
  });

  it('handles new download_url format correctly', () => {
    const order = createMockOrder({
      status: 'completed',
      download_url: 'https://api.docfiscal.com/orders/123/download',
      processing_completed_at: '2024-01-01T10:05:00Z',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    const downloadButton = screen.getByRole('button', {
      name: /download csv/i,
    });
    fireEvent.click(downloadButton);

    // Should not call the callback since download_url is provided
    expect(mockOnDownloadClick).not.toHaveBeenCalled();
  });

  it('handles backward compatibility with legacy fields', () => {
    const order = createMockOrder({
      status: 'pending_payment',
      paymentUrl: 'https://legacy.payment.com/pay/123', // Legacy field
      checkout_url: undefined, // New field not present
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    const payButton = screen.getByRole('button', { name: /complete payment/i });
    fireEvent.click(payButton);

    // Should not call the callback since legacy paymentUrl is provided
    expect(mockOnPaymentClick).not.toHaveBeenCalled();
  });

  it('handles string date format correctly', () => {
    const order = createMockOrder({
      created_at: '2024-02-20T15:45:30Z',
      processing_completed_at: '2024-02-20T16:00:00Z',
      status: 'completed',
    });

    renderWithQueryClient(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    // Should display both creation and completion dates
    expect(screen.getByText(/february|feb/i)).toBeInTheDocument();
    expect(screen.getByText(/completed:/i)).toBeInTheDocument();
  });
});
