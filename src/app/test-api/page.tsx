'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

export default function TestApiPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testRegister = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      const response = await apiClient.register({
        name: 'Test User',
        email: `test${Date.now()}@example.com`,
        password: 'test123'
      });
      
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    setLoading(true);
    setResult('Testing health check...');
    
    try {
      const response = await apiClient.healthCheck();
      setResult(JSON.stringify(response, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="space-y-4">
        <button 
          onClick={testHealthCheck}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
        >
          Test Health Check
        </button>
        
        <button 
          onClick={testRegister}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Test Register
        </button>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Result:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {result}
        </pre>
      </div>
    </div>
  );
}