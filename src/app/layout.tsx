import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import '@/lib/global-error-handler'; // Initialize global error handling

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DocFiscal - PDF to CSV Converter',
  description: 'Convert your PDF documents to CSV format easily and securely',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
