import { redirect } from 'next/navigation';

export default async function TenantEntryPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  redirect(`/${tenantSlug}/report`);
}
