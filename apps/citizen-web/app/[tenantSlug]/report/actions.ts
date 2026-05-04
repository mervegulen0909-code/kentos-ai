'use server';

import { redirect } from 'next/navigation';
import { citizenApi } from '../../../lib/api';

function normalizePhone(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/[\s()-]+/g, '');
  return normalized;
}

function isValidPhone(input: string) {
  return /^\+?[0-9]{10,15}$/.test(input);
}

function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export async function createReportAction(tenantSlug: string, formData: FormData) {
  const description = String(formData.get('description') ?? '').trim();
  const addressText = String(formData.get('addressText') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (description.length < 10) redirect(`/${tenantSlug}/report?error=description&field=description`);
  if (phone && !isValidPhone(phone)) redirect(`/${tenantSlug}/report?error=phone&field=phone`);
  if (email && !isValidEmail(email)) redirect(`/${tenantSlug}/report?error=email&field=email`);

  let trackingToken: string;

  try {
    const ticket = await citizenApi.createTicket(tenantSlug, {
      description,
      addressText: addressText || undefined,
      displayName: displayName || undefined,
      phone: phone || undefined,
      email: email || undefined,
    });
    if (!ticket.trackingToken) redirect(`/${tenantSlug}/report?error=api`);
    trackingToken = ticket.trackingToken;
  } catch {
    redirect(`/${tenantSlug}/report?error=api`);
  }

  redirect(`/${tenantSlug}/ticket/${trackingToken}`);
}
