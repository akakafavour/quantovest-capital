import './globals.css';
import type { Metadata } from 'next';
import TawkToWidget from '@/components/TawkToWidget';

export const metadata: Metadata = {
  title: 'Quantovest Capital — FX, Crypto & Stock Investment Platform',
  description: 'Start investing from $1,500. Follow expert portfolio managers across FX, Crypto, and Stocks. Track your returns live.',
  keywords: ['investment management', 'FX trading', 'crypto portfolio', 'stock market', 'managed portfolio', 'quantovest capital'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="bg-white text-[#0A0D0C] min-h-screen flex flex-col font-sans antialiased">
        {children}
        <TawkToWidget />
      </body>
    </html>
  );
}
