'use server';

import { createHash } from 'node:crypto';
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

function parseCoordinate(input: FormDataEntryValue | null) {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;

  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export async function createReportAction(tenantSlug: string, formData: FormData) {
  const description = String(formData.get('description') ?? '').trim();
  const addressText = String(formData.get('addressText') ?? '').trim();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const phone = normalizePhone(String(formData.get('phone') ?? ''));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const latitude = parseCoordinate(formData.get('latitude'));
  const longitude = parseCoordinate(formData.get('longitude'));

  if (description.length < 10) redirect(`/${tenantSlug}/report?error=description&field=description`);
  if (phone && !isValidPhone(phone)) redirect(`/${tenantSlug}/report?error=phone&field=phone`);
  if (email && !isValidEmail(email)) redirect(`/${tenantSlug}/report?error=email&field=email`);

  let trackingToken: string;

  try {
    const attachmentIds = await uploadAttachmentIfPresent(tenantSlug, formData);
    const ticket = await citizenApi.createTicket(tenantSlug, {
      description,
      addressText: addressText || undefined,
      displayName: displayName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      latitude,
      longitude,
      attachmentIds,
    });
    if (!ticket.trackingToken) redirect(`/${tenantSlug}/report?error=api`);
    trackingToken = ticket.trackingToken;
  } catch {
    redirect(`/${tenantSlug}/report?error=api`);
  }

  redirect(`/${tenantSlug}/ticket/${trackingToken}`);
}

async function uploadAttachmentIfPresent(tenantSlug: string, formData: FormData) {
  const file = formData.get('attachment');
  if (!(file instanceof File) || file.size <= 0) return [];

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
  const initiated = await citizenApi.initiateAttachmentUpload(tenantSlug, {
    fileName: file.name || 'attachment',
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });
  const uploadResponse = await fetch(initiated.uploadUrl, {
    method: 'PUT',
    headers: initiated.headers,
    body: bytes,
  });
  if (!uploadResponse.ok) throw new Error('Attachment upload failed');

  await citizenApi.confirmAttachmentUpload(tenantSlug, initiated.attachmentId, checksumSha256);
  return [initiated.attachmentId];
}
