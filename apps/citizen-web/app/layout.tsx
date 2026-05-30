import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { PwaRegister } from './components/pwa-register';

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  title: 'KentOS AI Vatandaş Başvuru',
  description: 'Belediye talep ve şikayet bildirim ekranı',
  applicationName: 'KentOS Vatandaş',
  category: 'government',
  metadataBase,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KentOS Vatandaş',
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/icon', type: 'image/png', sizes: '1024x1024' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/icon', type: 'image/png', sizes: '1024x1024' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading headers opts into dynamic rendering, which causes Next.js to
  // read the per-request x-nonce set by middleware and stamp it onto every
  // framework-generated <script> tag so that strict-dynamic CSP works.
  await headers();

  return (
    <html lang="tr">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

function resolveMetadataBase() {
  const baseUrl = process.env.NEXT_PUBLIC_CITIZEN_WEB_BASE_URL ?? process.env.PUBLIC_CITIZEN_BASE_URL;
  if (!baseUrl) {
    return undefined;
  }

  try {
    return new URL(baseUrl);
  } catch {
    return undefined;
  }
}
