const PHONE_PATTERN = /(\+?\d[\d\s\-().]{6,}\d)/g;
const EMAIL_PATTERN = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const NATIONAL_ID_PATTERN = /\b(\d{11})\b/g;

export function maskPhone(value: string): string {
  return value.replace(PHONE_PATTERN, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length < 6) return match;
    const tail = digits.slice(-2);
    return `***${tail}`;
  });
}

export function maskEmail(value: string): string {
  return value.replace(EMAIL_PATTERN, (_match, local: string, domain: string) => {
    const visible = local.slice(0, 1);
    return `${visible}***@${domain}`;
  });
}

export function maskNationalId(value: string): string {
  return value.replace(NATIONAL_ID_PATTERN, (match) => `***${match.slice(-2)}`);
}

export function maskPii(value: string): string {
  if (!value) return value;
  return maskNationalId(maskEmail(maskPhone(value)));
}

export function maskPiiInRecord<T extends Record<string, unknown>>(record: T, fields: Array<keyof T>): T {
  const next = { ...record } as T;
  for (const field of fields) {
    const original = record[field];
    if (typeof original === 'string') {
      next[field] = maskPii(original) as T[keyof T];
    }
  }
  return next;
}

export function safeLogString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return maskPii(value);
  try {
    return maskPii(JSON.stringify(value));
  } catch {
    return '[unserializable]';
  }
}
