import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { citizenApi, type PublicWidgetSettings } from '../../lib/api';
import { FloatingMascot } from '../components/floating-mascot';

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenantSlug)) {
    notFound();
  }

  let settings: PublicWidgetSettings;
  try {
    settings = await citizenApi.getWidgetSettings(tenantSlug);
  } catch {
    notFound();
  }

  return (
    <>
      {children}
      <FloatingMascot
        tenantSlug={tenantSlug}
        title={settings.widgetTitle || 'Belediye Asistanı'}
        welcome={settings.widgetWelcome || 'Merhaba! Size nasıl yardımcı olabilirim?'}
        enabled={settings.widgetEnabled}
      />
    </>
  );
}
