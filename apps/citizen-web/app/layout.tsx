import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from './components/pwa-register';

export const metadata: Metadata = {
  title: 'KentOS AI Vatandaş Başvuru',
  description: 'Belediye talep ve şikayet bildirim ekranı',
  applicationName: 'KentOS Vatandaş',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KentOS Vatandaş',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
