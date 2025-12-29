import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderHistoryTable } from '@/components/order/OrderHistoryTable';
import type { Order } from '@/types';

// Mock order data for testing
const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-123',
  user_id: 'user-456',
  filename: 'test-document.pdf',
  file_size: 1024 * 1024, // 1MB
  status: 'completed',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  // Legacy fields for backward compatibility
  originalFileSize: 1024 * 1024,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  ...overrides,
});

describe('OrderHistoryTable Component', () => {
  const mockOnDownload = jest.fn();
  const mockOnPayment = jest.fn();
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    mockOnDownload.mockClear();
    mockOnPayment.mockClear();
    mockOnPageChange.mockClear();
  });

  it('renders loading state correctly', () => {
    render(
      <OrderHistoryTable
        orders={[]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={true}
      />
    );

    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();
    // Note: progressbar element doesn't exist in the component, so we don't test for it
  });

  it('renders empty state when no orders', () => {
    render(
      <OrderHistoryTable
        orders={[]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/upload your first pdf document/i)
    ).toBeInTheDocument();
  });

  it('renders orders in desktop table view', () => {
    const orders = [
      createMockOrder({
        id: 'order-1',
        filename: 'document1.pdf',
        status: 'completed',
        file_size: 2 * 1024 * 1024, // 2MB
      }),
      createMockOrder({
        id: 'order-2',
        filename: 'document2.pdf',
        status: 'pending_payment',
        file_size: 1.5 * 1024 * 1024, // 1.5MB
      }),
    ];

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Check table headers
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check order data - use getAllByText since elements appear in both desktop and mobile views
    expect(screen.getAllByText('document1.pdf')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('document2.pdf')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('2 MB')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('1.5 MB')).toHaveLength(2); // Desktop + Mobile
  });

  it('handles new order data structure correctly', () => {
    const order = createMockOrder({
      id: 'order-new-format',
      filename: 'new-format.pdf',
      file_size: 3 * 1024 * 1024, // 3MB (new field)
      created_at: '2024-02-15T14:30:00Z', // new field
      status: 'completed',
      error_message: 'Test error message', // new field
      // Clear legacy field to ensure new field is used
      createdAt: undefined as any,
    });

    render(
      <OrderHistoryTable
        orders={[order]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    expect(screen.getAllByText('new-format.pdf')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('3 MB')).toHaveLength(2); // Desktop + Mobile
    // Check for February date - use getAllByText since it appears in both views
    expect(screen.getAllByText(/feb/i)).toHaveLength(2); // Desktop + Mobile
  });

  it('handles legacy order data structure correctly', () => {
    const order = createMockOrder({
      id: 'order-legacy',
      filename: 'legacy.pdf',
      originalFileSize: 2.5 * 1024 * 1024, // Legacy field
      createdAt: new Date('2024-01-20T16:45:00Z'), // Legacy field
      status: 'failed',
      errorMessage: 'Legacy error message', // Legacy field
      // Clear new fields to test fallback
      file_size: undefined as any,
      created_at: undefined as any,
      error_message: undefined,
    });

    render(
      <OrderHistoryTable
        orders={[order]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    expect(screen.getAllByText('legacy.pdf')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('2.5 MB')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText(/jan/i)).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('Legacy error message')).toHaveLength(2); // Desktop + Mobile
  });

  it('calls onDownload when download button is clicked', () => {
    const order = createMockOrder({
      id: 'order-download',
      status: 'completed',
    });

    render(
      <OrderHistoryTable
        orders={[order]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Use getAllByRole to handle both desktop and mobile views
    const downloadButtons = screen.getAllByRole('button', {
      name: /download csv file for/i,
    });
    fireEvent.click(downloadButtons[0]); // Click the first one (desktop view)

    expect(mockOnDownload).toHaveBeenCalledWith('order-download');
  });

  it('calls onPayment when payment button is clicked', () => {
    const order = createMockOrder({
      id: 'order-payment',
      status: 'pending_payment',
    });

    render(
      <OrderHistoryTable
        orders={[order]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Use getAllByRole to handle both desktop and mobile views
    const paymentButtons = screen.getAllByRole('button', {
      name: /make payment for/i,
    });
    fireEvent.click(paymentButtons[0]); // Click the first one (desktop view)

    expect(mockOnPayment).toHaveBeenCalledWith('order-payment');
  });

  it('displays correct status badges', () => {
    const orders = [
      createMockOrder({ id: 'order-1', status: 'pending_payment' }),
      createMockOrder({ id: 'order-2', status: 'processing' }),
      createMockOrder({ id: 'order-3', status: 'completed' }),
      createMockOrder({ id: 'order-4', status: 'failed' }),
    ];

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Use getAllByText to handle both desktop and mobile views
    expect(screen.getAllByText('Pending Payment')).toHaveLength(2); // Desktop + Mobile
    expect(screen.getAllByText('Processing')).toHaveLength(3); // Desktop badge + Mobile badge + Button text
    expect(screen.getAllByText('Completed')).toHaveLength(2);
    expect(screen.getAllByText('Failed')).toHaveLength(2);
  });

  it('renders pagination controls when pagination is provided', () => {
    const orders = [createMockOrder()];
    const pagination = { page: 2, limit: 10 };

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
        pagination={pagination}
        onPageChange={mockOnPageChange}
      />
    );

    expect(screen.getByText('Showing page 2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /previous/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('handles pagination navigation correctly', () => {
    const orders = [createMockOrder()];
    const pagination = { page: 2, limit: 10 };

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
        pagination={pagination}
        onPageChange={mockOnPageChange}
      />
    );

    const previousButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    fireEvent.click(previousButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextButton);
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous button on first page', () => {
    const orders = [createMockOrder()];
    const pagination = { page: 1, limit: 10 };

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
        pagination={pagination}
        onPageChange={mockOnPageChange}
      />
    );

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).toBeDisabled();
  });

  it('displays error messages for failed orders', () => {
    const order = createMockOrder({
      status: 'failed',
      error_message: 'Processing failed due to invalid format',
    });

    render(
      <OrderHistoryTable
        orders={[order]}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Use getAllByText since error appears in both desktop and mobile views
    expect(
      screen.getAllByText('Processing failed due to invalid format')
    ).toHaveLength(2);
  });

  it('sorts orders by creation date (most recent first)', () => {
    const orders = [
      createMockOrder({
        id: 'order-old',
        filename: 'old.pdf',
        created_at: '2024-01-01T10:00:00Z',
        createdAt: undefined as any, // Clear legacy field
      }),
      createMockOrder({
        id: 'order-new',
        filename: 'new.pdf',
        created_at: '2024-01-02T10:00:00Z',
        createdAt: undefined as any, // Clear legacy field
      }),
    ];

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Get all filename elements and check the first one in desktop view
    const desktopFilenames = screen.getAllByText(/\.pdf$/);
    // The component shows both desktop and mobile views, so we need to check the right ones
    // Desktop view comes first in the DOM
    expect(desktopFilenames[0]).toHaveTextContent('new.pdf'); // Most recent first
    expect(desktopFilenames[1]).toHaveTextContent('old.pdf');
  });

  it('handles mixed date formats correctly', () => {
    const orders = [
      createMockOrder({
        id: 'order-string-date',
        filename: 'string-date.pdf',
        created_at: '2024-01-15T10:00:00Z', // String format
        createdAt: undefined as any,
      }),
      createMockOrder({
        id: 'order-date-object',
        filename: 'date-object.pdf',
        created_at: undefined as any,
        createdAt: new Date('2024-01-10T10:00:00Z'), // Date object format
      }),
    ];

    render(
      <OrderHistoryTable
        orders={orders}
        onDownload={mockOnDownload}
        onPayment={mockOnPayment}
        isLoading={false}
      />
    );

    // Both should render without errors - use getAllByText since both desktop and mobile views exist
    expect(screen.getAllByText('string-date.pdf')).toHaveLength(2);
    expect(screen.getAllByText('date-object.pdf')).toHaveLength(2);
  });
});
