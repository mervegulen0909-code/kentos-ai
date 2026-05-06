import { trackingTokenSchema } from './schemas.js';
import type { IntakeClassification, PublicTicketAiIntakeRequest } from './types.js';

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCitizenContact(contact?: PublicTicketAiIntakeRequest['message']['citizenContact']) {
  const phone = normalizeText(contact?.phone);
  const email = normalizeText(contact?.email)?.toLocaleLowerCase('tr-TR') ?? null;
  const displayName = normalizeText(contact?.displayName);

  return {
    phone,
    email,
    displayName,
  };
}

function hasAddressSignal(text: string) {
  return /\b(mahalle|mah\.|sokak|sk\.|cadde|cd\.|bulvar|no:|apartman|site)\b/i.test(text);
}

function detectLanguage(text: string): IntakeClassification['language'] {
  return /[çğıöşü]/i.test(text) || /\b(mahalle|sokak|cadde|başvuru|basvuru)\b/i.test(text) ? 'tr' : 'unknown';
}

function buildTitle(text: string) {
  return text.length <= 80 ? text : `${text.slice(0, 77).trimEnd()}...`;
}

function extractNeighborhood(text: string) {
  const match = text.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+Mahallesi)/i);
  return match?.[1] ?? null;
}

function extractLocation(text: string): IntakeClassification['location'] {
  const match = text.match(/(-?\d{1,2}\.\d+)\s*[,; ]\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  return {
    latitude,
    longitude,
    accuracyMeters: null,
  };
}

function extractTrackingToken(text: string): IntakeClassification['statusTicketNo'] {
  const match = text.match(/\b(TK-[A-F0-9]{16})\b/i);
  if (!match) return null;

  return trackingTokenSchema.parse(match[1].toUpperCase());
}

function buildFollowUpQuestion(input: {
  missingFields: IntakeClassification['missingFields'];
  hasReachableContact: boolean;
  hasStatusIntent: boolean;
}) {
  const prompts: string[] = [];

  if (input.missingFields.includes('category')) prompts.push('talebinizin konusunu');
  if (input.missingFields.includes('location')) prompts.push('konumu');
  if (input.missingFields.includes('contact') && !input.hasStatusIntent && !input.hasReachableContact) prompts.push('size dönüş yapabileceğimiz telefon veya e-posta bilgisini');

  if (!prompts.length) return null;
  if (prompts.length === 1) return `Lütfen ${prompts[0]} paylaşır mısınız?`;
  if (prompts.length === 2) return `Lütfen ${prompts[0]} ve ${prompts[1]} paylaşır mısınız?`;

  const head = prompts.slice(0, -1).join(', ');
  const tail = prompts[prompts.length - 1];
  return `Lütfen ${head} ve ${tail} paylaşır mısınız?`;
}

export function buildDeterministicIntakeClassification(input: PublicTicketAiIntakeRequest): IntakeClassification {
  const text = input.message.text.trim();
  const normalized = text.toLocaleLowerCase('tr-TR');
  const departmentMatch = input.tenantContext.departments.find((department) => {
    const code = department.code.toLocaleLowerCase('tr-TR');
    const name = department.name.toLocaleLowerCase('tr-TR');
    return normalized.includes(code) || normalized.includes(name);
  });
  const categoryMatch = input.tenantContext.categories.find((category) => {
    const code = category.code.toLocaleLowerCase('tr-TR');
    const name = category.name.toLocaleLowerCase('tr-TR');
    return normalized.includes(code) || normalized.includes(name);
  });
  const guardedCategoryMatch = categoryMatch && departmentMatch && categoryMatch.departmentId && categoryMatch.departmentId !== departmentMatch.id
    ? null
    : categoryMatch;
  const guardedDepartmentMatch = departmentMatch ?? input.tenantContext.departments.find((department) => department.id === guardedCategoryMatch?.departmentId) ?? null;
  const location = extractLocation(text);
  const hasStatusIntent = /\b(tk-[a-z0-9-]+|başvuru|basvuru|durum|takip|sorgu)\b/i.test(text);
  const emergencyHint = /\b(acil|yangın|yangin|yaralı|yarali|tehlike|tehdit)\b/i.test(text);
  const normalizedCitizenContact = normalizeCitizenContact(input.message.citizenContact);
  const hasReachableContact = Boolean(normalizedCitizenContact.phone || normalizedCitizenContact.email);
  const missingFields = [
    ...(!guardedCategoryMatch ? ['category'] as const : []),
    ...(!location && !hasAddressSignal(normalized) ? ['location'] as const : []),
    ...(!hasReachableContact && !hasStatusIntent ? ['contact'] as const : []),
  ];

  return {
    language: detectLanguage(normalized),
    intent: hasStatusIntent ? 'status_query' : 'new_ticket',
    title: buildTitle(text),
    description: text,
    requestType: emergencyHint ? 'emergency_flag' : 'complaint',
    categoryCode: guardedCategoryMatch?.code ?? null,
    departmentCode: guardedDepartmentMatch?.code ?? null,
    priority: emergencyHint ? 'HIGH' : 'NORMAL',
    urgencyReason: emergencyHint ? 'Metinde aciliyet ifadesi tespit edildi.' : null,
    addressText: hasAddressSignal(normalized) ? text : null,
    neighborhoodName: extractNeighborhood(text),
    location,
    citizenContact: normalizedCitizenContact,
    missingFields,
    followUpQuestion: buildFollowUpQuestion({
      missingFields,
      hasReachableContact,
      hasStatusIntent,
    }),
    statusTicketNo: hasStatusIntent ? extractTrackingToken(text) : null,
    safetyFlags: emergencyHint ? ['threat'] : ['none'],
    confidence: missingFields.length ? 0.55 : 0.72,
    reasoningSummary: hasStatusIntent
      ? 'Deterministik fallback metni durum sorgusu olarak işaretledi.'
      : 'Deterministik fallback metni yeni talep olarak işaretledi.',
  };
}
