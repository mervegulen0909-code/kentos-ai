import {
  buildDeterministicIntakeClassification,
  intakeClassificationSchema,
  intakeMessageInputSchema,
  intakePromptEnvelopeSchema,
  intakeTenantConfigSchema,
  publicTicketAiIntakeRequestSchema,
  publicTicketAiIntakeResultSchema,
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
    const classification = buildDeterministicIntakeClassification(request);
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
