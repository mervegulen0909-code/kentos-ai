import type { IntakeCitizenContact } from './types.js';

export type NormalizedCitizenContact = {
  displayName: string | null;
  phone: string | null;
  email: string | null;
};

export type CitizenIdentifierInput = {
  kind: 'PHONE' | 'EMAIL';
  normalizedValue: string;
};

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeCitizenPhone(value?: string | null) {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return null;

  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && digits[1] === '5') return `9${digits}`;
  if (digits.length === 12 && digits.startsWith('90') && digits[2] === '5') return digits;
  if (digits.length === 13 && digits.startsWith('0090') && digits[4] === '5') return digits.slice(2);

  return digits.length >= 10 ? digits : null;
}

export function normalizeCitizenEmail(value?: string | null) {
  const trimmed = normalizeText(value);
  return trimmed ? trimmed.toLocaleLowerCase('en-US') : null;
}

export function normalizeCitizenDisplayName(value?: string | null) {
  return normalizeText(value);
}

export function normalizeCitizenContact(input?: IntakeCitizenContact | null): NormalizedCitizenContact {
  return {
    displayName: normalizeCitizenDisplayName(input?.displayName),
    phone: normalizeCitizenPhone(input?.phone),
    email: normalizeCitizenEmail(input?.email),
  };
}

export function normalizeCitizenContactValue(contact?: string | null, displayName?: string | null): NormalizedCitizenContact {
  const normalizedContact = normalizeText(contact);
  return normalizeCitizenContact({
    displayName,
    phone: normalizedContact,
    email: normalizedContact,
  });
}

export function mergeCitizenContact(previous?: IntakeCitizenContact | null, next?: IntakeCitizenContact | null): NormalizedCitizenContact {
  const normalizedPrevious = normalizeCitizenContact(previous);
  const normalizedNext = normalizeCitizenContact(next);

  return {
    displayName: normalizedNext.displayName ?? normalizedPrevious.displayName,
    phone: normalizedNext.phone ?? normalizedPrevious.phone,
    email: normalizedNext.email ?? normalizedPrevious.email,
  };
}

export function buildCitizenIdentifierInputs(contact?: IntakeCitizenContact | null): CitizenIdentifierInput[] {
  const normalized = normalizeCitizenContact(contact);
  return [
    ...(normalized.phone ? [{ kind: 'PHONE' as const, normalizedValue: normalized.phone }] : []),
    ...(normalized.email ? [{ kind: 'EMAIL' as const, normalizedValue: normalized.email }] : []),
  ];
}
