import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  userId: 'user-456',
  filename: 'test-document.pdf',
  originalFileSize: 1024 * 1024, // 1MB
  status: 'pending_payment',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

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
      paymentUrl: 'https://mercadopago.com/payment/123',
    });

    render(
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

    render(
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
      downloadUrl: 'https://api.docfiscal.com/download/123',
      completedAt: new Date('2024-01-01T10:05:00Z'),
    });

    render(
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
      errorMessage: 'Unable to process the PDF file',
    });

    render(
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

  it('calls onPaymentClick when pay button is clicked and no paymentUrl', () => {
    const order = createMockOrder({
      status: 'pending_payment',
      paymentUrl: undefined, // No URL, so callback should be called
    });

    render(
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

  it('calls onDownloadClick when download button is clicked and no downloadUrl', () => {
    const order = createMockOrder({
      status: 'completed',
      downloadUrl: undefined, // No URL, so callback should be called
      completedAt: new Date('2024-01-01T10:05:00Z'),
    });

    render(
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
      createdAt: new Date('2024-01-15T14:30:00Z'),
    });

    render(
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
      originalFileSize: 2.5 * 1024 * 1024, // 2.5MB
    });

    render(
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

    render(
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

    render(
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
      errorMessage: undefined, // Missing error message
    });

    render(
      <OrderStatusCard
        order={order}
        onPaymentClick={mockOnPaymentClick}
        onDownloadClick={mockOnDownloadClick}
      />
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
    // Should not crash when errorMessage is undefined
  });
});
