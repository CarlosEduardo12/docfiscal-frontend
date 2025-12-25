'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/hooks/useAuthNew';

export default function TestUploadPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const testUpload = async () => {
    setLoading(true);
    setResult('Testing upload...');

    try {
      // Create a simple test file
      const testContent = 'This is a test PDF content';
      const blob = new Blob([testContent], { type: 'application/pdf' });
      const file = new File([blob], 'test.pdf', { type: 'application/pdf' });

      console.log('Test file created:', file);
      console.log('User:', user);

      const response = await apiClient.uploadFile(file);
      console.log('Upload response:', response);

      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Upload error:', error);
      setResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    setResult('Testing auth...');

    try {
      const response = await apiClient.getProfile();
      console.log('Profile response:', response);
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('Auth error:', error);
      setResult(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Test Page</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold">User Info:</h3>
        <p>Logged in: {user ? 'Yes' : 'No'}</p>
        <p>User ID: {user?.id || 'N/A'}</p>
        <p>User Email: {user?.email || 'N/A'}</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={testAuth}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
        >
          Test Auth
        </button>

        <button
          onClick={testUpload}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded mr-4"
        >
          Test Upload
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Result:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">{result}</pre>
      </div>
    </div>
  );
}
