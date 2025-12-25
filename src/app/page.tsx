'use client';

import { useAuth } from '@/hooks/useAuthNew';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversionFlow } from '@/components/conversion/ConversionFlow';
import { FileText, Download, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // If not authenticated, show landing page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">DocFiscal</h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Converta seus PDFs em CSV de forma rápida, segura e profissional
            </p>
            <div className="space-x-4">
              <Button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
              >
                Fazer Login
              </Button>
              <Button
                onClick={() => router.push('/register')}
                variant="outline"
                className="px-8 py-3 text-lg"
              >
                Criar Conta
              </Button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  Processamento Rápido
                </h3>
                <p className="text-gray-600">
                  Converta seus arquivos em segundos com nossa tecnologia
                  avançada
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">100% Seguro</h3>
                <p className="text-gray-600">
                  Seus dados são protegidos e automaticamente excluídos após a
                  conversão
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Alta Qualidade</h3>
                <p className="text-gray-600">
                  Conversão precisa mantendo a integridade dos seus dados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How it works */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-12">
              Como Funciona
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h4 className="text-lg font-semibold mb-2">Upload do PDF</h4>
                <p className="text-gray-600">Faça upload do seu arquivo PDF</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h4 className="text-lg font-semibold mb-2">Pagamento</h4>
                <p className="text-gray-600">Complete o pagamento via PIX</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h4 className="text-lg font-semibold mb-2">Download</h4>
                <p className="text-gray-600">
                  Baixe seu arquivo CSV convertido
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, show conversion interface
  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Converter PDF para CSV
          </h1>
          <p className="text-gray-600">
            Transforme seus documentos PDF em formato CSV de forma rápida e
            fácil
          </p>
        </div>

        {/* Main Conversion Flow */}
        <ConversionFlow />

        {/* Additional Information */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Processamento Rápido
                  </h4>
                  <p className="text-sm text-gray-500">
                    Converta arquivos em segundos
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Nosso mecanismo de processamento avançado converte seus
                documentos PDF para formato CSV rapidamente e com precisão,
                mantendo a integridade dos dados durante todo o processo.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Download className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Seguro e Privado
                  </h4>
                  <p className="text-sm text-gray-500">
                    Seus arquivos são protegidos
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Todos os arquivos são processados com segurança e
                automaticamente excluídos após a conversão. Nunca armazenamos
                seus dados pessoais por mais tempo que o necessário.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
