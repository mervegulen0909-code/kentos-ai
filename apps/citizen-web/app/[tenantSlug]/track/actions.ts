'use server';

import { redirect } from 'next/navigation';
import { getTrackRedirectPath } from './token';

export async function trackTicketAction(tenantSlug: string, formData: FormData) {
  const rawTrackingToken = String(formData.get('trackingToken') ?? '');
  redirect(getTrackRedirectPath(tenantSlug, rawTrackingToken));
}
