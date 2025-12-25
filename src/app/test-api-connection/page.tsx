'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestApiConnectionPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test: string, success: boolean, data: any) => {
    const result = {
      test,
      success,
      data,
      timestamp: new Date().toLocaleTimeString()
    };
    setResults(prev => [result, ...prev]);
  };

  const testHealthCheck = async () => {
    try {
      const response = await apiClient.healthCheck();
      addResult('Health Check', true, response);
    } catch (error: any) {
      addResult('Health Check', false, { error: error.message });
    }
  };

  const testAuthenticatedCall = async () => {
    try {
      const response = await apiClient.getProfile();
      addResult('Get Profile (Authenticated)', response.success, response);
    } catch (error: any) {
      addResult('Get Profile (Authenticated)', false, { error: error.message });
    }
  };

  const testPaymentCall = async () => {
    try {
      // Usar um ID de teste
      const response = await apiClient.initiatePayment('test-order-id');
      addResult('Initiate Payment', response.success, response);
    } catch (error: any) {
      addResult('Initiate Payment', false, { error: error.message });
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setResults([]);
    
    await testHealthCheck();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testAuthenticatedCall();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testPaymentCall();
    
    setLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Conexão com API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
              </div>
              <div>
                <strong>Autenticado:</strong> {apiClient.isAuthenticated ? 'Sim' : 'Não'}
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={testHealthCheck} size="sm" variant="outline">
                Testar Health Check
              </Button>
              <Button onClick={testAuthenticatedCall} size="sm" variant="outline">
                Testar Autenticação
              </Button>
              <Button onClick={testPaymentCall} size="sm" variant="outline">
                Testar Pagamento
              </Button>
              <Button onClick={runAllTests} disabled={loading} className="bg-blue-600">
                {loading ? 'Testando...' : 'Executar Todos'}
              </Button>
              <Button onClick={clearResults} variant="outline" size="sm">
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados dos Testes</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-gray-500">Nenhum teste executado ainda.</p>
            ) : (
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-4 rounded border ${
                      result.success 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">
                        {result.success ? '✅' : '❌'} {result.test}
                      </h3>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                    <pre className="text-xs overflow-auto bg-white p-2 rounded border">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}