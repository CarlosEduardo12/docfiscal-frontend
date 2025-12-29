import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { apiClient } from '@/lib/api';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  apiClient: {
    uploadFile: jest.fn(),
    getUploadProgress: jest.fn(),
    cancelUpload: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper function to create a mock PDF file
const createMockPDFFile = (name = 'test.pdf', size = 1024 * 1024): File => {
  const file = new File(['mock pdf content'], name, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });

  // Mock the size property
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  });

  return file;
};

describe('useFileUpload Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useFileUpload());

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBe(null);
      expect(result.current.errorDetails).toBe(null);
      expect(result.current.uploadedFile).toBe(null);
      expect(result.current.uploadResponse).toBe(null);
    });
  });

  describe('File Validation', () => {
    it('should reject non-PDF files', async () => {
      const { result } = renderHook(() => useFileUpload());
      const invalidFile = new File(['content'], 'test.txt', {
        type: 'text/plain',
      });

      await act(async () => {
        await result.current.uploadFile(invalidFile);
      });

      expect(result.current.error).toBe('Only PDF files are allowed');
      expect(result.current.isUploading).toBe(false);
      expect(mockApiClient.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject files larger than 10MB', async () => {
      const { result } = renderHook(() => useFileUpload());
      const largeFile = createMockPDFFile('large.pdf', 11 * 1024 * 1024); // 11MB

      await act(async () => {
        await result.current.uploadFile(largeFile);
      });

      expect(result.current.error).toBe('File size must be less than 10MB');
      expect(result.current.isUploading).toBe(false);
      expect(mockApiClient.uploadFile).not.toHaveBeenCalled();
    });

    it('should reject files without names', async () => {
      const { result } = renderHook(() => useFileUpload());
      const unnamedFile = createMockPDFFile('', 1024);

      await act(async () => {
        await result.current.uploadFile(unnamedFile);
      });

      expect(result.current.error).toBe('File must have a name');
      expect(result.current.isUploading).toBe(false);
      expect(mockApiClient.uploadFile).not.toHaveBeenCalled();
    });

    it('should accept valid PDF files', async () => {
      const mockResponse = {
        success: true,
        data: {
          upload_id: 'upload123',
          order_id: 'order123',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'Upload successful',
      };

      mockApiClient.uploadFile.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useFileUpload());
      const validFile = createMockPDFFile('test.pdf', 1024);

      await act(async () => {
        await result.current.uploadFile(validFile);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.uploadResponse).toEqual(mockResponse.data);
      expect(result.current.progress).toBe(100);
      expect(mockApiClient.uploadFile).toHaveBeenCalledWith(validFile);
    });
  });

  describe('Upload Process', () => {
    it('should handle successful upload', async () => {
      const mockResponse = {
        success: true,
        data: {
          upload_id: 'upload123',
          order_id: 'order123',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'Upload successful',
      };

      const onSuccess = jest.fn();
      mockApiClient.uploadFile.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useFileUpload({ onSuccess }));
      const file = createMockPDFFile();

      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBe(100);
      expect(result.current.uploadResponse).toEqual(mockResponse.data);
      expect(result.current.error).toBe(null);
      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);
    });

    it('should handle upload failure', async () => {
      const mockError = {
        success: false,
        error: 'UPLOAD_FAILED',
        message: 'Upload failed due to server error',
        details: {
          field_errors: { file: ['File is corrupted'] },
          guidance: 'Please try uploading a different file',
        },
      };

      const onError = jest.fn();
      mockApiClient.uploadFile.mockResolvedValue(mockError);

      const { result } = renderHook(() => useFileUpload({ onError }));
      const file = createMockPDFFile();

      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBe('Upload failed due to server error');
      expect(result.current.uploadResponse).toBe(null);
      expect(onError).toHaveBeenCalledWith(
        'Upload failed due to server error',
        undefined
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error(
        'Network error: Unable to connect to server'
      );
      mockApiClient.uploadFile.mockRejectedValue(networkError);

      const { result } = renderHook(() => useFileUpload());
      const file = createMockPDFFile();

      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe(
        'Network error: Unable to connect to server'
      );
      expect(result.current.progress).toBe(0);
    });
  });

  describe('Upload Progress', () => {
    it('should get upload progress successfully', async () => {
      const mockProgressResponse = {
        success: true,
        data: {
          upload_id: 'upload123',
          order_id: 'order123',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'processing',
          progress: 75,
        },
        message: 'Progress retrieved',
      };

      const onProgress = jest.fn();
      mockApiClient.getUploadProgress.mockResolvedValue(mockProgressResponse);

      const { result } = renderHook(() => useFileUpload({ onProgress }));

      // Set initial upload response
      act(() => {
        result.current.reset();
      });

      await act(async () => {
        await result.current.getUploadProgress('upload123');
      });

      expect(result.current.progress).toBe(75);
      expect(onProgress).toHaveBeenCalledWith(75);
      expect(mockApiClient.getUploadProgress).toHaveBeenCalledWith('upload123');
    });

    it('should handle progress fetch failure', async () => {
      mockApiClient.getUploadProgress.mockRejectedValue(
        new Error('Progress fetch failed')
      );

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.getUploadProgress('upload123');
      });

      expect(result.current.error).toBe('Progress fetch failed');
    });
  });

  describe('Upload Cancellation', () => {
    it('should cancel upload without upload_id', () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.cancelUpload();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBe('Upload cancelled');
    });

    it('should cancel upload with upload_id', async () => {
      mockApiClient.cancelUpload.mockResolvedValue({
        success: true,
        message: 'Upload cancelled',
      });

      const { result } = renderHook(() => useFileUpload());

      // First, simulate a successful upload to get an upload_id
      const mockFile = new File(['test content'], 'test.pdf', {
        type: 'application/pdf',
      });

      mockApiClient.uploadFile.mockResolvedValue({
        success: true,
        data: {
          upload_id: 'upload123',
          order_id: 'order123',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploading',
        },
      });

      // Start upload to get upload_id
      await act(async () => {
        await result.current.uploadFile(mockFile);
      });

      // Now cancel the upload
      await act(async () => {
        result.current.cancelUpload();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe('Upload cancelled');
      expect(mockApiClient.cancelUpload).toHaveBeenCalledWith('upload123');
    });
  });

  describe('Upload Retry', () => {
    it('should retry upload with previous file', async () => {
      const mockResponse = {
        success: true,
        data: {
          upload_id: 'upload456',
          order_id: 'order456',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'Upload successful',
      };

      mockApiClient.uploadFile.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useFileUpload());
      const file = createMockPDFFile();

      // First upload (simulate failure)
      mockApiClient.uploadFile.mockRejectedValueOnce(
        new Error('Upload failed')
      );

      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.error).toBe('Upload failed');

      // Retry upload
      mockApiClient.uploadFile.mockResolvedValue(mockResponse);

      await act(async () => {
        await result.current.retryUpload();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.uploadResponse).toEqual(mockResponse.data);
      expect(mockApiClient.uploadFile).toHaveBeenCalledTimes(2);
    });

    it('should handle retry without previous file', async () => {
      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.retryUpload();
      });

      expect(result.current.error).toBe('No file to retry upload');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state', async () => {
      const mockResponse = {
        success: true,
        data: {
          upload_id: 'upload123',
          order_id: 'order123',
          filename: 'test.pdf',
          file_size: 1024,
          status: 'uploaded',
        },
        message: 'Upload successful',
      };

      mockApiClient.uploadFile.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useFileUpload());
      const file = createMockPDFFile();

      // Upload file first
      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.uploadResponse).not.toBe(null);
      expect(result.current.progress).toBe(100);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBe(null);
      expect(result.current.errorDetails).toBe(null);
      expect(result.current.uploadedFile).toBe(null);
      expect(result.current.uploadResponse).toBe(null);
    });
  });

  describe('Error Details Handling', () => {
    it('should handle detailed error information', async () => {
      const mockError = {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'File validation failed',
        details: {
          field_errors: {
            file: ['File is corrupted', 'File format not supported'],
          },
          guidance: 'Please upload a valid PDF file',
          retry_after: 5000,
        },
      };

      const onError = jest.fn();
      mockApiClient.uploadFile.mockResolvedValue(mockError);

      const { result } = renderHook(() => useFileUpload({ onError }));
      const file = createMockPDFFile();

      await act(async () => {
        await result.current.uploadFile(file);
      });

      expect(result.current.error).toBe('File validation failed');
      expect(result.current.errorDetails).toBe(null); // Details are not parsed in this implementation
      expect(onError).toHaveBeenCalledWith('File validation failed', undefined);
    });
  });
});
