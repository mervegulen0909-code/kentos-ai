import { z } from 'zod';
export const trackingTokenSchema = z.custom<`TK-${string}`>((value) => typeof value === 'string' && /^TK-[A-F0-9]{16}$/.test(value));

export const intakeClassificationSchema = z.object({
  language: z.enum(['tr', 'en', 'unknown']),
  intent: z.enum(['new_ticket', 'status_query', 'add_info', 'human_handoff', 'general_question', 'unsupported']),
  title: z.string().min(1),
  description: z.string().min(1),
  requestType: z.enum(['complaint', 'request', 'question', 'emergency_flag', 'other']),
  categoryCode: z.string().nullable(),
  departmentCode: z.string().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  urgencyReason: z.string().nullable(),
  addressText: z.string().nullable(),
  neighborhoodName: z.string().nullable(),
  location: z
    .object({
      // Prisma Decimal(10,7) ile uyumlu: -90..90 / -180..180, max 7 ondalık basamak
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  citizenContact: z.object({
    phone: z.string().nullable(),
    email: z.string().email().nullable(),
    displayName: z.string().nullable(),
  }),
  missingFields: z.array(z.enum(['description', 'location', 'contact', 'category', 'photo'])),
  followUpQuestion: z.string().nullable(),
  statusTicketNo: trackingTokenSchema.nullable(),
  safetyFlags: z.array(z.enum(['threat', 'injury', 'fire', 'violence', 'animal_danger', 'none'])),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string(),
});

export const intakeTenantOptionSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  departmentId: z.string().min(1).nullable().optional(),
});

export const intakeTenantConfigSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  departments: z.array(intakeTenantOptionSchema),
  categories: z.array(intakeTenantOptionSchema),
});

export const intakeChannelSchema = z.enum([
  'WHATSAPP',
  'CITIZEN_WEB',
  'WEB_CHAT',
  'MOBILE_APP',
  'INSTAGRAM',
  'FACEBOOK',
  'SMS',
  'EMAIL',
]);

export const intakeCitizenContactSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Geçersiz telefon formatı').nullable().optional(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().nullable().optional(),
});

export const intakeMessageInputSchema = z.object({
  text: z.string().min(1),
  channel: intakeChannelSchema,
  receivedAt: z.string().datetime(),
  citizenContact: intakeCitizenContactSchema.optional(),
});

export const channelMediaMetadataSchema = z.object({
  providerMediaId: z.string().optional(),
  mimeType: z.string().min(1),
  fileName: z.string().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  url: z.string().url().optional(),
});

export const channelIntakeEnvelopeSchema = z.object({
  tenantId: z.string().min(1).optional(),
  tenantSlug: z.string().min(1).optional(),
  channel: intakeChannelSchema,
  provider: z.string().min(1),
  externalConversationId: z.string().min(1).optional(),
  externalMessageId: z.string().min(1).optional(),
  text: z.string().min(1),
  media: z.array(channelMediaMetadataSchema).optional(),
  receivedAt: z.string().datetime(),
  citizenContact: intakeCitizenContactSchema.optional(),
  raw: z.unknown().optional(),
}).refine((value) => Boolean(value.tenantId || value.tenantSlug), {
  message: 'tenantId veya tenantSlug zorunludur',
  path: ['tenantSlug'],
});

export const channelOutboundEnvelopeSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  channel: intakeChannelSchema,
  conversationId: z.string().min(1),
  externalConversationId: z.string().min(1).optional(),
  recipient: z.object({
    phone: z.string().min(1).optional(),
    email: z.string().email().optional(),
  }).refine((r) => r.phone || r.email, { message: 'recipient.phone veya recipient.email gerekli' }),
  text: z.string().min(1),
  templateKey: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export const intakePromptEnvelopeSchema = z.object({
  version: z.string().min(1),
  system: z.string().min(1),
  tenantContext: intakeTenantConfigSchema,
  input: intakeMessageInputSchema,
});

export const publicTicketAiIntakeRequestSchema = z.object({
  tenantContext: intakeTenantConfigSchema,
  message: intakeMessageInputSchema,
});

export const publicTicketAiIntakeResultSchema = z.object({
  provider: z.enum(['stub', 'netiva', 'anthropic']),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  classification: intakeClassificationSchema,
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
});
