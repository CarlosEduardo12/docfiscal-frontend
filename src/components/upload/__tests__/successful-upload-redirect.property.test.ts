/**
 * **Feature: frontend-issues-resolution, Property 10: Successful upload redirects with confirmation**
 * **Validates: Requirements 3.5**
 */

import * as fc from 'fast-check';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload } from '@/hooks/useFileUpload';

// Mock the API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    uploadFile: jest.fn()
  }
}));

import { apiClient } from '@/lib/api';

describe('Successful Upload Redirect Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 10: Successful upload redirects with confirmation', () => {
    test('should provide success callback with upload details for redirect', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => `redirect-test-${s.trim().replace(/[^a-zA-Z0-9]/g, 'x')}.pdf`),
            orderId: fc.uuid(),
            uploadId: fc.uuid(),
            fileSize: fc.integer({ min: 1024, max: 10 * 1024 * 1024 })
          }),
          async (uploadData) => {
            const mockFile = new File(['test content'], uploadData.fileName, {
              type: 'application/pdf'
            });

            // Mock successful API response
            (apiClient.uploadFile as jest.Mock).mockResolvedValue({
              success: true,
              data: {
                upload_id: uploadData.uploadId,
                order_id: uploadData.orderId,
                filename: uploadData.fileName,
                file_size: uploadData.fileSize,
                status: 'uploaded',
                progress: 100
              }
            });

            const onSuccessMock = jest.fn();
            
            const { result } = renderHook(() => 
              useFileUpload({
                onSuccess: onSuccessMock
              })
            );

            // Wait for hook to be ready
            await waitFor(() => {
              expect(result.current).toBeTruthy();
            });

            // Perform upload
            await act(async () => {
              await result.current.uploadFile(mockFile);
            });

            // Property: Upload should complete successfully
            expect(result.current.error).toBeNull();
            expect(result.current.uploadResponse).toBeTruthy();
            expect(result.current.uploadResponse?.order_id).toBe(uploadData.orderId);
            expect(result.current.progress).toBe(100);

            // Property: Success callback should be called with upload response
            expect(onSuccessMock).toHaveBeenCalledWith({
              upload_id: uploadData.uploadId,
              order_id: uploadData.orderId,
              filename: uploadData.fileName,
              file_size: uploadData.fileSize,
              status: 'uploaded',
              progress: 100
            });

            // Property: Success callback should be called exactly once
            expect(onSuccessMock).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should provide confirmation data for successful uploads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => `confirm-test-${s.trim().replace(/[^a-zA-Z0-9]/g, 'x')}.pdf`),
            orderId: fc.uuid(),
            uploadId: fc.uuid()
          }),
          async (confirmData) => {
            const mockFile = new File(['test content'], confirmData.fileName, {
              type: 'application/pdf'
            });

            // Mock successful API response
            (apiClient.uploadFile as jest.Mock).mockResolvedValue({
              success: true,
              data: {
                upload_id: confirmData.uploadId,
                order_id: confirmData.orderId,
                filename: confirmData.fileName,
                file_size: mockFile.size,
                status: 'uploaded',
                progress: 100
              }
            });

            const confirmationMessages: string[] = [];
            const onSuccessMock = jest.fn((response) => {
              // Simulate confirmation message generation
              confirmationMessages.push(`Upload successful: ${response.filename}`);
              confirmationMessages.push(`Order ID: ${response.order_id}`);
              confirmationMessages.push(`File size: ${response.file_size} bytes`);
            });

            const { result } = renderHook(() => 
              useFileUpload({
                onSuccess: onSuccessMock
              })
            );

            // Wait for hook to be ready
            await waitFor(() => {
              expect(result.current).toBeTruthy();
            });

            // Perform upload
            await act(async () => {
              await result.current.uploadFile(mockFile);
            });

            // Property: Confirmation should include file details
            expect(confirmationMessages).toContain(`Upload successful: ${confirmData.fileName}`);
            expect(confirmationMessages).toContain(`Order ID: ${confirmData.orderId}`);
            expect(confirmationMessages).toContain(`File size: ${mockFile.size} bytes`);

            // Property: Upload response should contain all necessary data for confirmation
            const response = result.current.uploadResponse;
            expect(response?.filename).toBe(confirmData.fileName);
            expect(response?.order_id).toBe(confirmData.orderId);
            expect(response?.upload_id).toBe(confirmData.uploadId);
            expect(response?.status).toBe('uploaded');
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should not trigger success callback on upload failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => `failure-test-${s.trim().replace(/[^a-zA-Z0-9]/g, 'x')}.pdf`),
            errorMessage: fc.string({ minLength: 5, maxLength: 50 })
              .filter(s => s.trim().length > 0)
              .map(s => `Upload error: ${s.trim()}`)
          }),
          async (failureData) => {
            const mockFile = new File(['test content'], failureData.fileName, {
              type: 'application/pdf'
            });

            // Mock API failure
            (apiClient.uploadFile as jest.Mock).mockRejectedValue(new Error(failureData.errorMessage));

            const onSuccessMock = jest.fn();
            const onErrorMock = jest.fn();

            const { result } = renderHook(() => 
              useFileUpload({
                onSuccess: onSuccessMock,
                onError: onErrorMock
              })
            );

            // Wait for hook to be ready
            await waitFor(() => {
              expect(result.current).toBeTruthy();
            });

            // Perform upload (should fail)
            await act(async () => {
              await result.current.uploadFile(mockFile);
            });

            // Property: Success callback should not be called on failure
            expect(onSuccessMock).not.toHaveBeenCalled();

            // Property: Error callback should be called with error message
            expect(onErrorMock).toHaveBeenCalledWith(failureData.errorMessage);

            // Property: Upload should be in error state
            expect(result.current.error).toBe(failureData.errorMessage);
            expect(result.current.uploadResponse).toBeNull();
            expect(result.current.progress).toBe(0);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should preserve upload state for redirect data access', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => `state-test-${s.trim().replace(/[^a-zA-Z0-9]/g, 'x')}.pdf`),
            orderId: fc.uuid(),
            uploadId: fc.uuid(),
            fileSize: fc.integer({ min: 1024, max: 10 * 1024 * 1024 })
          }),
          async (stateData) => {
            const mockFile = new File(['test content'], stateData.fileName, {
              type: 'application/pdf'
            });

            // Mock successful API response
            (apiClient.uploadFile as jest.Mock).mockResolvedValue({
              success: true,
              data: {
                upload_id: stateData.uploadId,
                order_id: stateData.orderId,
                filename: stateData.fileName,
                file_size: stateData.fileSize,
                status: 'uploaded',
                progress: 100
              }
            });

            const { result } = renderHook(() => useFileUpload());

            // Wait for hook to be ready
            await waitFor(() => {
              expect(result.current).toBeTruthy();
            });

            // Perform upload
            await act(async () => {
              await result.current.uploadFile(mockFile);
            });

            // Property: Upload state should be preserved after successful completion
            expect(result.current.uploadedFile).toBe(mockFile);
            expect(result.current.uploadResponse).toBeTruthy();
            
            // Property: All upload data should be accessible for redirect
            const response = result.current.uploadResponse;
            expect(response?.upload_id).toBe(stateData.uploadId);
            expect(response?.order_id).toBe(stateData.orderId);
            expect(response?.filename).toBe(stateData.fileName);
            expect(response?.file_size).toBe(stateData.fileSize);
            expect(response?.status).toBe('uploaded');
            expect(response?.progress).toBe(100);

            // Property: Upload should not be in loading state after completion
            expect(result.current.isUploading).toBe(false);
            expect(result.current.error).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});