import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LiveProvider } from './components/live-provider';

export const metadata: Metadata = {
  title: 'KentOS AI Operasyon Paneli',
  description: 'Belediye talep, SLA ve operasyon yönetimi paneli',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <LiveProvider>{children}</LiveProvider>
      </body>
    </html>
  );
}
