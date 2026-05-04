import {
  intakeClassificationSchema,
  intakeMessageInputSchema,
  intakePromptEnvelopeSchema,
  intakeTenantConfigSchema,
  publicTicketAiIntakeRequestSchema,
  publicTicketAiIntakeResultSchema,
  trackingTokenSchema,
  type IntakeClassification,
  type IntakeMessageInput,
  type IntakePromptEnvelope,
  type IntakeTenantConfig,
  type PublicTicketAiIntakeRequest,
  type PublicTicketAiIntakeResult,
} from '@kentos/shared';
import { intakeClassifierPromptV1 } from './prompts/intake-classifier.v1.js';

export class IntakeClassifierService {
  createPromptEnvelope(input: { tenantContext: IntakeTenantConfig; message: IntakeMessageInput }): IntakePromptEnvelope {
    return intakePromptEnvelopeSchema.parse({
      version: intakeClassifierPromptV1.version,
      system: intakeClassifierPromptV1.system,
      tenantContext: intakeTenantConfigSchema.parse(input.tenantContext),
      input: intakeMessageInputSchema.parse(input.message),
    });
  }

  buildPrompt(input: { tenantContext: IntakeTenantConfig; message: IntakeMessageInput }) {
    const envelope = this.createPromptEnvelope(input);
    return {
      version: intakeClassifierPromptV1.version,
      system: intakeClassifierPromptV1.system,
      user: intakeClassifierPromptV1.buildUserPrompt(envelope),
      envelope,
    };
  }

  parseModelOutput(raw: string): IntakeClassification {
    return intakeClassificationSchema.parse(JSON.parse(raw));
  }
}

export class PublicTicketAiRunnerService {
  constructor(private readonly classifier = new IntakeClassifierService()) {}

  async classify(input: PublicTicketAiIntakeRequest): Promise<PublicTicketAiIntakeResult> {
    const request = publicTicketAiIntakeRequestSchema.parse(input);
    const requestedAt = new Date().toISOString();
    const prompt = this.classifier.buildPrompt(request);
    const classification = this.buildDeterministicFallback(request);
    const completedAt = new Date().toISOString();

    return publicTicketAiIntakeResultSchema.parse({
      provider: 'stub',
      model: 'deterministic-fallback',
      promptVersion: prompt.version,
      classification,
      requestedAt,
      completedAt,
    });
  }

  private buildDeterministicFallback(input: PublicTicketAiIntakeRequest): IntakeClassification {
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
    const location = this.extractLocation(text);
    const hasStatusIntent = /\b(tk-[a-z0-9-]+|başvuru|basvuru|durum|takip|sorgu)\b/i.test(text);
    const emergencyHint = /\b(acil|yangın|yangin|yaralı|yarali|tehlike|tehdit)\b/i.test(text);
    const normalizedCitizenContact = this.normalizeCitizenContact(input.message.citizenContact);
    const hasReachableContact = Boolean(normalizedCitizenContact.phone || normalizedCitizenContact.email);
    const needsCategory = !guardedCategoryMatch;
    const needsLocation = !location && !this.hasAddressSignal(normalized);
    const missingFields = [
      ...(needsCategory ? ['category'] as const : []),
      ...(needsLocation ? ['location'] as const : []),
      ...(!hasReachableContact && !hasStatusIntent ? ['contact'] as const : []),
    ];

    return {
      language: this.detectLanguage(normalized),
      intent: hasStatusIntent ? 'status_query' : 'new_ticket',
      title: this.buildTitle(text),
      description: text,
      requestType: emergencyHint ? 'emergency_flag' : 'complaint',
      categoryCode: guardedCategoryMatch?.code ?? null,
      departmentCode: guardedDepartmentMatch?.code ?? null,
      priority: emergencyHint ? 'HIGH' : 'NORMAL',
      urgencyReason: emergencyHint ? 'Metinde aciliyet ifadesi tespit edildi.' : null,
      addressText: this.hasAddressSignal(normalized) ? text : null,
      neighborhoodName: this.extractNeighborhood(text),
      location,
      citizenContact: normalizedCitizenContact,
      missingFields,
      followUpQuestion: this.buildFollowUpQuestion({
        missingFields,
        hasReachableContact,
        hasStatusIntent,
      }),
      statusTicketNo: hasStatusIntent ? this.extractTicketNo(text) : null,
      safetyFlags: emergencyHint ? ['threat'] : ['none'],
      confidence: missingFields.length ? 0.55 : 0.72,
      reasoningSummary: hasStatusIntent
        ? 'Deterministik fallback metni durum sorgusu olarak işaretledi.'
        : 'Deterministik fallback metni yeni talep olarak işaretledi.',
    };
  }

  private detectLanguage(text: string): IntakeClassification['language'] {
    return /[çğıöşü]/i.test(text) || /\b(mahalle|sokak|cadde|başvuru|basvuru)\b/i.test(text) ? 'tr' : 'unknown';
  }

  private buildTitle(text: string) {
    return text.length <= 80 ? text : `${text.slice(0, 77).trimEnd()}...`;
  }

  private hasAddressSignal(text: string) {
    return /\b(mahalle|mah\.|sokak|sk\.|cadde|cd\.|bulvar|no:|apartman|site)\b/i.test(text);
  }

  private extractNeighborhood(text: string) {
    const match = text.match(/([A-ZÇĞİÖŞÜa-zçğıöşü]+\s+Mahallesi)/i);
    return match?.[1] ?? null;
  }

  private extractTicketNo(text: string): IntakeClassification['statusTicketNo'] {
    const match = text.match(/\b(TK-[A-F0-9]{16})\b/i);
    if (!match) return null;

    return trackingTokenSchema.parse(match[1].toUpperCase());
  }

  private normalizeCitizenContact(contact?: PublicTicketAiIntakeRequest['message']['citizenContact']) {
    const phone = this.normalizeText(contact?.phone);
    const email = this.normalizeText(contact?.email)?.toLocaleLowerCase('tr-TR') ?? null;
    const displayName = this.normalizeText(contact?.displayName);

    return {
      phone,
      email,
      displayName,
    };
  }

  private buildFollowUpQuestion(input: {
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

  private normalizeText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private extractLocation(text: string): IntakeClassification['location'] {
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
}

async function runDemo() {
  const demoTenantContext: IntakeTenantConfig = {
    tenantId: 'demo-tenant-id',
    tenantSlug: 'demo-belediye',
    departments: [
      { id: 'dep-fen', code: 'FEN', name: 'Fen İşleri' },
      { id: 'dep-zabita', code: 'ZABITA', name: 'Zabıta' },
    ],
    categories: [
      { id: 'cat-road', code: 'YOL_BAKIM', name: 'Yol Bakım', departmentId: 'dep-fen' },
      { id: 'cat-clean', code: 'TEMIZLIK', name: 'Temizlik', departmentId: 'dep-zabita' },
    ],
  };

  const demoMessage: IntakeMessageInput = {
    text: 'Atatürk Mahallesi 12. Sokak yanında çukur oluştu, araçlar geçerken tehlike yaratıyor.',
    channel: 'CITIZEN_WEB',
    receivedAt: new Date().toISOString(),
    citizenContact: {
      phone: '+905551112233',
      displayName: 'Demo Vatandaş',
    },
  };

  const runner = new PublicTicketAiRunnerService();
  const result = await runner.classify({ tenantContext: demoTenantContext, message: demoMessage });

  console.log(`KentOS AI service ready with prompt ${result.promptVersion}`);
  console.log(JSON.stringify(result.classification));
}

if (process.argv[1]?.endsWith('main.ts') || process.argv[1]?.endsWith('main.js')) {
  void runDemo();
}
