import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { citizenApi } from '../../lib/api';

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

  try {
    await citizenApi.getWidgetSettings(tenantSlug);
  } catch {
    notFound();
  }

  return <>{children}</>;
}
