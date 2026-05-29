import { channelIntakeEnvelopeSchema, channelOutboundEnvelopeSchema, intakeCitizenContactSchema, publicTicketAiIntakeRequestSchema, publicTicketAiIntakeResultSchema } from './schemas.js';
import type { PublicTicketAiIntakeRequest, PublicTicketAiIntakeResult } from './types.js';

function buildValidRequest(): PublicTicketAiIntakeRequest {
  return {
    tenantContext: {
      tenantId: 'tenant-1',
      tenantSlug: 'kadikoy',
      departments: [
        { id: 'dep-1', code: 'FEN', name: 'Fen Isleri' },
        { id: 'dep-2', code: 'ZABITA', name: 'Zabita' },
      ],
      categories: [
        { id: 'cat-1', code: 'YOL', name: 'Yol Bakim', departmentId: 'dep-1' },
        { id: 'cat-2', code: 'TEMIZLIK', name: 'Temizlik', departmentId: 'dep-2' },
      ],
    },
    message: {
      text: 'Moda Caddesi uzerinde cokme var, donus icin 5551234567 numarasindan ulasabilirsiniz.',
      channel: 'CITIZEN_WEB',
      receivedAt: '2026-05-03T12:00:00.000Z',
      citizenContact: {
        phone: '+905551234567',
        email: 'vatandas@example.org',
        displayName: 'Ayse Yilmaz',
      },
    },
  };
}

function buildValidResult(): PublicTicketAiIntakeResult {
  return {
    provider: 'stub',
    model: 'deterministic-fallback',
    promptVersion: 'intake-classifier.v1',
    requestedAt: '2026-05-03T12:00:00.000Z',
    completedAt: '2026-05-03T12:00:01.000Z',
    classification: {
      language: 'tr',
      intent: 'new_ticket',
      title: 'Yolda cokme bildirimi',
      description: 'Moda Caddesi uzerinde cokme var.',
      requestType: 'complaint',
      categoryCode: 'YOL',
      departmentCode: 'FEN',
      priority: 'HIGH',
      urgencyReason: 'Yaya guvenligi riski olusturuyor.',
      addressText: 'Moda Caddesi',
      neighborhoodName: 'Caferaga',
      location: {
        latitude: 40.9871,
        longitude: 29.0277,
        accuracyMeters: 15,
      },
      citizenContact: {
        phone: '+905551234567',
        email: 'vatandas@example.org',
        displayName: 'Ayse Yilmaz',
      },
      missingFields: [],
      followUpQuestion: null,
      statusTicketNo: null,
      safetyFlags: ['none'],
      confidence: 0.92,
      reasoningSummary: 'Metin yol bozulmasi ve lokasyon bilgisi iceriyor.',
    },
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testValidRequestSchema() {
  const parsed = publicTicketAiIntakeRequestSchema.safeParse(buildValidRequest());
  assert(parsed.success, 'valid intake request should parse');
  assert(parsed.data.message.citizenContact?.email === 'vatandas@example.org', 'email should survive parsing');
}

function testRejectInvalidRequestEmail() {
  const invalid = buildValidRequest();
  invalid.message.citizenContact = {
    ...invalid.message.citizenContact,
    email: 'not-an-email',
  };

  const parsed = publicTicketAiIntakeRequestSchema.safeParse(invalid);
  assert(!parsed.success, 'invalid email should fail request parsing');
}

function testValidResultSchema() {
  const parsed = publicTicketAiIntakeResultSchema.safeParse(buildValidResult());
  assert(parsed.success, 'valid intake result should parse');
  assert(parsed.data.classification.confidence === 0.92, 'confidence should survive parsing');
}

function testValidOpenAiResultSchema() {
  const openaiResult: PublicTicketAiIntakeResult = {
    ...buildValidResult(),
    provider: 'openai',
    model: 'gpt-4o',
  };

  const parsed = publicTicketAiIntakeResultSchema.safeParse(openaiResult);
  assert(parsed.success, 'valid OpenAI intake result should parse');
  assert(parsed.data.provider === 'openai', 'OpenAI provider should survive parsing');
}

function testRejectInvalidMissingField() {
  const invalid = buildValidResult() as PublicTicketAiIntakeResult & {
    classification: Omit<PublicTicketAiIntakeResult['classification'], 'missingFields'> & { missingFields: string[] };
  };
  invalid.classification = {
    ...invalid.classification,
    missingFields: ['unsupported_field'],
  } as typeof invalid.classification;

  const parsed = publicTicketAiIntakeResultSchema.safeParse(invalid);
  assert(!parsed.success, 'unsupported missing field should fail result parsing');
}

function testRejectInvalidConfidence() {
  const invalid = buildValidResult();
  invalid.classification = {
    ...invalid.classification,
    confidence: 1.4,
  };

  const parsed = publicTicketAiIntakeResultSchema.safeParse(invalid);
  assert(!parsed.success, 'confidence above 1 should fail result parsing');
}

function testRejectLegacyStatusTicketNo() {
  const valid = buildValidResult();
  const invalid = {
    ...valid,
    classification: {
      ...valid.classification,
      intent: 'status_query',
      statusTicketNo: 'KNT-2026-000001',
    },
  };

  const parsed = publicTicketAiIntakeResultSchema.safeParse(invalid);
  assert(!parsed.success, 'legacy internal ticket numbers should fail AI result parsing');
}

function testEmailChannelEnvelopeSchema() {
  const parsed = channelIntakeEnvelopeSchema.safeParse({
    tenantSlug: 'demo-belediye',
    channel: 'EMAIL',
    provider: 'smtp',
    externalConversationId: 'email-thread-1',
    externalMessageId: 'email-message-1',
    text: 'E-posta ile gelen belediye talebi.',
    receivedAt: '2026-05-03T12:00:00.000Z',
    citizenContact: { email: 'vatandas@example.org' },
  });
  assert(parsed.success, 'EMAIL channel envelope should parse');
}

function testRecipientRequiresPhoneOrEmail() {
  // Both missing → refine should reject
  const result = channelOutboundEnvelopeSchema.safeParse({
    tenantId: 'tnt-1',
    tenantSlug: 'demo',
    channel: 'WHATSAPP',
    conversationId: 'cnv-1',
    recipient: {},
    text: 'Test mesaj',
  });
  assert(!result.success, 'recipient with neither phone nor email should fail');

  // Phone only → accept
  const withPhone = channelOutboundEnvelopeSchema.safeParse({
    tenantId: 'tnt-1',
    tenantSlug: 'demo',
    channel: 'WHATSAPP',
    conversationId: 'cnv-1',
    recipient: { phone: '+905551234567' },
    text: 'Test mesaj',
  });
  assert(withPhone.success, 'recipient with phone only should pass');

  // Email only → accept
  const withEmail = channelOutboundEnvelopeSchema.safeParse({
    tenantId: 'tnt-1',
    tenantSlug: 'demo',
    channel: 'EMAIL',
    conversationId: 'cnv-1',
    recipient: { email: 'vatandas@example.com' },
    text: 'Test mesaj',
  });
  assert(withEmail.success, 'recipient with email only should pass');
}

function testCitizenContactPhoneRegex() {
  // Valid E.164-like formats
  const validPhones = ['+905551234567', '+1234567890', '905551234567'];
  for (const phone of validPhones) {
    const result = intakeCitizenContactSchema.safeParse({ phone });
    assert(result.success, `phone '${phone}' should be valid`);
  }

  // Invalid formats
  const invalidPhones = ['abc', '123', '+0invalid', ''];
  for (const phone of invalidPhones) {
    const result = intakeCitizenContactSchema.safeParse({ phone });
    assert(!result.success, `phone '${phone}' should be invalid`);
  }

  // null is allowed
  const nullResult = intakeCitizenContactSchema.safeParse({ phone: null });
  assert(nullResult.success, 'null phone should be valid');

  // undefined is allowed
  const undefResult = intakeCitizenContactSchema.safeParse({});
  assert(undefResult.success, 'missing phone should be valid (optional)');
}

testValidRequestSchema();
testRejectInvalidRequestEmail();
testValidResultSchema();
testValidOpenAiResultSchema();
testRejectInvalidMissingField();
testRejectInvalidConfidence();
testRejectLegacyStatusTicketNo();
testEmailChannelEnvelopeSchema();
testRecipientRequiresPhoneOrEmail();
testCitizenContactPhoneRegex();

console.log('shared intake schema tests passed');
