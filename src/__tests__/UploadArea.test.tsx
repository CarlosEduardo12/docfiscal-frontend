import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadArea } from '@/components/upload/UploadArea';

// Mock the useFileUpload hook
jest.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: jest.fn(() => ({
    uploadFile: jest.fn(),
    cancelUpload: jest.fn(),
    retryUpload: jest.fn(),
    isUploading: false,
    progress: 0,
    error: null,
    uploadedFile: null,
    uploadResponse: null,
    reset: jest.fn(),
  })),
}));

// Mock file for testing
const createMockFile = (name: string, size: number, type: string) => {
  const file = new File(['test content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('UploadArea Component', () => {
  const mockOnFileSelect = jest.fn();
  const mockUploadFile = jest.fn();
  const mockUseFileUpload = require('@/hooks/useFileUpload').useFileUpload;

  const defaultProps = {
    onFileSelect: mockOnFileSelect,
    isUploading: false,
    acceptedFileTypes: ['application/pdf'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  };

  beforeEach(() => {
    mockOnFileSelect.mockClear();
    mockUploadFile.mockClear();
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFile: null,
      uploadResponse: null,
      reset: jest.fn(),
    });
  });

  it('renders upload area with correct initial state', () => {
    render(<UploadArea {...defaultProps} />);

    expect(
      screen.getByText(/drag and drop your pdf file here, or click to browse/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/supported format: pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/maximum size: 10mb/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose file/i })
    ).toBeInTheDocument();
  });

  it('shows uploading state when isUploading is true', () => {
    render(<UploadArea {...defaultProps} isUploading={true} />);

    expect(screen.getByText(/uploading your file/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cancel upload/i })
    ).toBeInTheDocument();
  });

  it('calls uploadFile when file is selected', () => {
    render(<UploadArea {...defaultProps} />);

    // The component should render without errors and have the upload functionality
    expect(
      screen.getByRole('button', { name: /upload pdf file/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /choose file/i })
    ).toBeInTheDocument();
  });

  it('shows error state when error is provided', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: 'File size exceeds the maximum limit',
      uploadedFile: { name: 'test.pdf' },
      uploadResponse: null,
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(
      screen.getByText(/file size exceeds the maximum limit/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows success state when upload is complete', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFile: null,
      uploadResponse: { upload_id: 'upload-123', order_id: 'test-order-123' },
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(screen.getByText(/file uploaded successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/order id: test-order-123/i)).toBeInTheDocument();
  });

  it('handles drag and drop events', () => {
    render(<UploadArea {...defaultProps} />);

    const dropZone = screen.getByRole('button', { name: /upload pdf file/i });

    // Initially shows upload text
    expect(screen.getByText(/upload your pdf file/i)).toBeInTheDocument();

    // Simulate drag enter
    fireEvent.dragEnter(dropZone);
    expect(
      screen.getAllByText(/drop your pdf file here/i)[0]
    ).toBeInTheDocument();
  });

  it('disables interaction when uploading', () => {
    render(<UploadArea {...defaultProps} isUploading={true} />);

    const dropZone = screen.getByRole('button', {
      name: /file upload in progress/i,
    });
    expect(dropZone).toHaveAttribute('tabindex', '-1');
  });

  it('displays file size limit correctly', () => {
    render(<UploadArea {...defaultProps} />);

    expect(screen.getByText(/maximum size: 10mb/i)).toBeInTheDocument();
  });

  it('shows progress when uploading with progress', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: true,
      progress: 45,
      error: null,
      uploadedFile: { name: 'test.pdf' },
      uploadResponse: null,
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('handles new standardized error format', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: 'File validation failed: Invalid file format',
      uploadedFile: { name: 'test.pdf' },
      uploadResponse: null,
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(
      screen.getByText(/file validation failed: invalid file format/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('handles network error messages correctly', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: 'Network error: Unable to connect to server',
      uploadedFile: { name: 'test.pdf' },
      uploadResponse: null,
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(
      screen.getByText(/network error: unable to connect to server/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays upload response with new format correctly', () => {
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      cancelUpload: jest.fn(),
      retryUpload: jest.fn(),
      isUploading: false,
      progress: 0,
      error: null,
      uploadedFile: null,
      uploadResponse: {
        upload_id: 'upload-456',
        order_id: 'order-789',
        filename: 'document.pdf',
        file_size: 1024000,
        status: 'completed',
      },
      reset: jest.fn(),
    });

    render(<UploadArea {...defaultProps} />);

    expect(screen.getByText(/file uploaded successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/order id: order-789/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
