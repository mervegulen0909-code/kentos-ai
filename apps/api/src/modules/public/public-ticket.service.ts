import { randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility, TicketStatus, type Prisma } from '@kentos/database';
import {
  buildDeterministicIntakeClassification,
  intakeClassificationSchema,
  publicTicketAiIntakeRequestSchema,
  publicTicketAiIntakeResultSchema,
  type IntakeClassification,
  type PublicTicketAiIntakeRequest,
  type PublicTicketAiIntakeResult,
} from '@kentos/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import {
  decideAiBudget,
  estimateCostMicros,
  extractAnthropicUsage,
  extractOpenAiUsage,
  mergeTenantBudget,
  normalizeTenantAiBudgetOverrides,
  readAiBudgetConfig,
  totalTokens,
  type AiBudgetConfig,
  type AiUsageInput,
} from './ai-cost-guard.js';
import { CitizenIdentityService } from './citizen-identity.service.js';
import { CreatePublicMessageDto } from './dto/create-public-message.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';

const AI_PURPOSE = 'public-intake-classification';

type AiProviderResult = PublicTicketAiIntakeResult & {
  __usage?: AiUsageInput;
  __success: boolean;
  __errorReason?: string;
};

@Injectable()
export class PublicTicketAiService {
  constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}

  async classify(input: PublicTicketAiIntakeRequest): Promise<PublicTicketAiIntakeResult> {
    const request = publicTicketAiIntakeRequestSchema.parse(this.normalizeRequestContact(input));
    const requestedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const tenantId = request.tenantContext.tenantId;
    const envConfig = readAiBudgetConfig();
    const tenantOverrides = await this.loadTenantBudgetOverrides(tenantId);
    const budgetConfig = mergeTenantBudget(envConfig, tenantOverrides);
    const budget = await this.checkBudget(tenantId, budgetConfig);

    let result: AiProviderResult;
    if (!budget.allowed) {
      result = this.markStubFallback(this.runDeterministic(request, requestedAt), `budget:${budget.reason}`);
    } else {
      result = await this.runProviderWithFallback(request, requestedAt, budgetConfig);
    }

    const latencyMs = Math.max(0, Date.now() - startedAtMs);
    await this.recordAiRun({
      tenantId,
      request,
      result,
      latencyMs,
      budgetConfig,
    });
    return this.stripInternals(result);
  }

  private async loadTenantBudgetOverrides(tenantId: string) {
    if (!this.prisma) return null;
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiBudgetOverrides: true } });
      return normalizeTenantAiBudgetOverrides(tenant?.aiBudgetOverrides);
    } catch {
      return null;
    }
  }

  private async checkBudget(tenantId: string, config: AiBudgetConfig) {
    if (!this.prisma || (config.dailyTokenBudget == null && config.dailyCostBudgetMicros == null)) {
      return decideAiBudget({ tokensTotal: 0, costMicros: 0 }, config);
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const aggregate = await this.prisma.aiRun.aggregate({
        where: { tenantId, purpose: AI_PURPOSE, createdAt: { gte: since } },
        _sum: { tokensTotal: true, costMicros: true },
      });
      return decideAiBudget(
        {
          tokensTotal: aggregate._sum.tokensTotal ?? 0,
          costMicros: aggregate._sum.costMicros ?? 0,
        },
        config,
      );
    } catch {
      return decideAiBudget({ tokensTotal: 0, costMicros: 0 }, config);
    }
  }

  private async runProviderWithFallback(
    request: PublicTicketAiIntakeRequest,
    requestedAt: string,
    budgetConfig: AiBudgetConfig,
  ): Promise<AiProviderResult> {
    const anthropicConfig = this.readAnthropicConfig();
    if (anthropicConfig.enabled) {
      try {
        return this.markSuccess(await this.classifyWithAnthropic(request, requestedAt, anthropicConfig, budgetConfig));
      } catch (error) {
        return this.markStubFallback(
          this.runDeterministic(request, requestedAt),
          `anthropic:${error instanceof Error ? error.message.slice(0, 120) : 'error'}`,
        );
      }
    }

    const netivaConfig = this.readNetivaConfig();
    if (netivaConfig.enabled) {
      try {
        return this.markSuccess(await this.classifyWithNetiva(request, requestedAt, netivaConfig, budgetConfig));
      } catch (error) {
        return this.markStubFallback(
          this.runDeterministic(request, requestedAt),
          `netiva:${error instanceof Error ? error.message.slice(0, 120) : 'error'}`,
        );
      }
    }

    return this.markSuccess(this.runDeterministic(request, requestedAt));
  }

  private runDeterministic(input: PublicTicketAiIntakeRequest, requestedAt: string): PublicTicketAiIntakeResult & { __usage?: AiUsageInput } {
    return {
      ...this.classifyWithDeterministicFallback(input, requestedAt),
    };
  }

  private markSuccess(value: PublicTicketAiIntakeResult & { __usage?: AiUsageInput }): AiProviderResult {
    return { ...value, __success: true };
  }

  private markStubFallback(value: PublicTicketAiIntakeResult, reason: string): AiProviderResult {
    return { ...value, __success: true, __errorReason: reason };
  }

  private stripInternals(result: AiProviderResult): PublicTicketAiIntakeResult {
    const { __usage: _usage, __success: _success, __errorReason: _err, ...rest } = result;
    return rest;
  }

  private async recordAiRun(input: {
    tenantId: string;
    request: PublicTicketAiIntakeRequest;
    result: AiProviderResult;
    latencyMs: number;
    budgetConfig: AiBudgetConfig;
  }) {
    if (!this.prisma) return;
    const usage = input.result.__usage ?? {};
    const tokensInput = typeof usage.tokensInput === 'number' ? usage.tokensInput : null;
    const tokensOutput = typeof usage.tokensOutput === 'number' ? usage.tokensOutput : null;
    const tokensTotal = totalTokens(usage) || null;
    const costMicros = tokensTotal != null ? estimateCostMicros(usage, input.budgetConfig) : null;

    try {
      await this.prisma.aiRun.create({
        data: {
          tenantId: input.tenantId,
          purpose: AI_PURPOSE,
          provider: input.result.provider,
          model: input.result.model,
          promptVersion: input.result.promptVersion,
          input: this.toJsonValue({ tenantSlug: input.request.tenantContext.tenantSlug, channel: input.request.message.channel }),
          output: this.toJsonValue({
            confidence: input.result.classification.confidence,
            intent: input.result.classification.intent,
            requestType: input.result.classification.requestType,
          }),
          confidence: input.result.classification.confidence,
          latencyMs: input.latencyMs,
          tokensInput: tokensInput ?? undefined,
          tokensOutput: tokensOutput ?? undefined,
          tokensTotal: tokensTotal ?? undefined,
          costMicros: costMicros ?? undefined,
          success: input.result.__success,
          errorReason: input.result.__errorReason ?? null,
        },
      });
    } catch {
      // telemetry failures must never block ticket intake
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private readAnthropicConfig() {
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || '';
    return {
      enabled: provider === 'anthropic' && Boolean(apiKey),
      apiKey,
      baseUrl: this.normalizeBaseUrl(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'),
      model: process.env.ANTHROPIC_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'claude-sonnet-4-6',
      timeoutMs: this.readPositiveInt(process.env.ANTHROPIC_TIMEOUT_MS || process.env.AI_TIMEOUT_MS, 15_000),
      maxTokens: this.readPositiveInt(process.env.ANTHROPIC_MAX_TOKENS || process.env.AI_MAX_TOKENS, 1_200),
      version: process.env.ANTHROPIC_API_VERSION?.trim() || '2023-06-01',
    };
  }

  private async classifyWithAnthropic(
    input: PublicTicketAiIntakeRequest,
    requestedAt: string,
    config: ReturnType<PublicTicketAiService['readAnthropicConfig']>,
    budgetConfig: AiBudgetConfig,
  ): Promise<PublicTicketAiIntakeResult & { __usage?: AiUsageInput }> {
    const maxTokens = budgetConfig.perRequestTokenLimit
      ? Math.min(config.maxTokens, budgetConfig.perRequestTokenLimit)
      : config.maxTokens;
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': config.version,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature: 0,
        system: [
          { type: 'text', text: this.buildSystemPrompt(), cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: this.buildUserPrompt(input) }],
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Anthropic AI request failed with ${response.status}`);
    }

    const payload = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    const content = payload.content?.find((part) => part.type === 'text')?.text;
    if (!content) throw new ServiceUnavailableException('Anthropic AI response did not include text content');

    const result = publicTicketAiIntakeResultSchema.parse({
      provider: 'anthropic',
      model: config.model,
      promptVersion: 'intake-classifier.v1',
      requestedAt,
      completedAt: new Date().toISOString(),
      classification: this.parseClassification(content),
    });
    return { ...result, __usage: extractAnthropicUsage(payload) };
  }

  private normalizeRequestContact(input: PublicTicketAiIntakeRequest): PublicTicketAiIntakeRequest {
    const contact = input.message.citizenContact;
    if (!contact) return input;

    const phone = this.cleanOptionalText(contact.phone);
    const email = this.cleanEmail(contact.email);
    const displayName = this.cleanOptionalText(contact.displayName);

    return {
      ...input,
      message: {
        ...input.message,
        citizenContact: { phone, email, displayName },
      },
    };
  }

  private classifyWithDeterministicFallback(
    input: PublicTicketAiIntakeRequest,
    requestedAt: string,
  ): PublicTicketAiIntakeResult {
    return publicTicketAiIntakeResultSchema.parse({
      provider: 'stub',
      model: 'deterministic-fallback',
      promptVersion: 'intake-classifier.v1',
      requestedAt,
      completedAt: new Date().toISOString(),
      classification: buildDeterministicIntakeClassification(input),
    });
  }

  private readNetivaConfig() {
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const apiKey = process.env.NETIVA_API_KEY?.trim() || process.env.AI_API_KEY?.trim() || '';

    return {
      enabled: provider === 'netiva' && Boolean(apiKey),
      apiKey,
      baseUrl: this.normalizeBaseUrl(process.env.NETIVA_BASE_URL || process.env.AI_BASE_URL || 'https://api.netiva.com.tr/v1'),
      model: process.env.NETIVA_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'claude-sonnet-4-6',
      timeoutMs: this.readPositiveInt(process.env.NETIVA_TIMEOUT_MS || process.env.AI_TIMEOUT_MS, 15_000),
      maxTokens: this.readPositiveInt(process.env.NETIVA_MAX_TOKENS || process.env.AI_MAX_TOKENS, 1_200),
    };
  }

  private async classifyWithNetiva(
    input: PublicTicketAiIntakeRequest,
    requestedAt: string,
    config: ReturnType<PublicTicketAiService['readNetivaConfig']>,
    budgetConfig: AiBudgetConfig,
  ): Promise<PublicTicketAiIntakeResult & { __usage?: AiUsageInput }> {
    const maxTokens = budgetConfig.perRequestTokenLimit
      ? Math.min(config.maxTokens, budgetConfig.perRequestTokenLimit)
      : config.maxTokens;
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          { role: 'user', content: this.buildUserPrompt(input) },
        ],
        temperature: 0,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`Netiva AI request failed with ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null }; text?: string | null }>;
      usage?: unknown;
    };
    const content = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
    if (!content) throw new ServiceUnavailableException('Netiva AI response did not include content');

    const result = publicTicketAiIntakeResultSchema.parse({
      provider: 'netiva',
      model: config.model,
      promptVersion: 'intake-classifier.v1',
      requestedAt,
      completedAt: new Date().toISOString(),
      classification: this.parseClassification(content),
    });
    return { ...result, __usage: extractOpenAiUsage(payload) };
  }

  private parseClassification(content: string): IntakeClassification {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const jsonText = fenced ?? trimmed;
    return intakeClassificationSchema.parse(JSON.parse(jsonText));
  }

  private buildSystemPrompt() {
    return [
      'Sen KentOS belediye operasyonlari icin guvenli bir AI intake siniflandiricisisin.',
      'Sadece gecerli JSON dondur. Markdown, aciklama, kod blogu veya ek metin dondurme.',
      'Vatandasa gizli alan, ic not, personel yorumu veya model akil yurutmesi ifsa etme.',
      'categoryCode ve departmentCode alanlarini yalniz verilen tenant seceneklerinden sec; emin degilsen null kullan.',
      'statusTicketNo yalniz TK-[A-F0-9]{16} formatinda takip kodu varsa dolu olsun; belediye ic ticket numarasi uretme.',
    ].join(' ');
  }

  private buildUserPrompt(input: PublicTicketAiIntakeRequest) {
    return JSON.stringify({
      task: 'Classify this citizen intake message for municipal ticket routing.',
      outputSchema: {
        language: 'tr | en | unknown',
        intent: 'new_ticket | status_query | add_info | human_handoff | general_question | unsupported',
        title: 'short public-safe title',
        description: 'normalized public-safe description',
        requestType: 'complaint | request | question | emergency_flag | other',
        categoryCode: 'one of tenant categories or null',
        departmentCode: 'one of tenant departments or null',
        priority: 'LOW | NORMAL | HIGH | URGENT',
        urgencyReason: 'string or null',
        addressText: 'string or null',
        neighborhoodName: 'string or null',
        location: '{ latitude, longitude, accuracyMeters } or null',
        citizenContact: '{ phone, email, displayName } with nulls for missing values',
        missingFields: 'array of description | location | contact | category | photo',
        followUpQuestion: 'Turkish citizen-facing question or null',
        statusTicketNo: 'TK-[A-F0-9]{16} or null',
        safetyFlags: 'array of threat | injury | fire | violence | animal_danger | none',
        confidence: 'number between 0 and 1',
        reasoningSummary: 'short operational summary, no hidden chain-of-thought',
      },
      tenantContext: input.tenantContext,
      message: input.message,
    });
  }

  private normalizeBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, '');
  }

  private readPositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private cleanOptionalText(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private cleanEmail(value: string | null | undefined) {
    const trimmed = this.cleanOptionalText(value);
    if (!trimmed) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
  }
}

@Injectable()
export class PublicTicketService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationQueueService) private readonly notifications: NotificationQueueService,
    @Inject(NotificationTemplateService) private readonly templates: NotificationTemplateService,
    @Inject(SlaService) private readonly sla: SlaService,
    @Inject(TicketNumberService) private readonly ticketNumbers: TicketNumberService,
    @Inject(PublicTicketAiService) private readonly ai: PublicTicketAiService,
    @Inject(CitizenIdentityService) private readonly citizenIdentity: CitizenIdentityService,
    @Inject(AttachmentsService) private readonly attachments: AttachmentsService,
  ) {}

  async create(tenantSlug: string, dto: CreatePublicTicketDto, options: { preferredCitizenId?: string | null } = {}) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');

    const channel = dto.channel ?? ChannelType.CITIZEN_WEB;
    const normalizedContact = this.citizenIdentity.normalizeContact({
      phone: dto.phone,
      email: dto.email,
      displayName: dto.displayName,
    });
    const citizen = await this.citizenIdentity.resolveCitizen({
      tenantId: tenant.id,
      contact: normalizedContact,
      source: this.identitySourceForChannel(channel),
      preferredCitizenId: options.preferredCitizenId,
    });

    const aiInput: PublicTicketAiIntakeRequest = {
      tenantContext: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        departments: await this.listTenantDepartments(tenant.id),
        categories: await this.listTenantCategories(tenant.id),
      },
      message: {
        text: dto.description,
        channel,
        receivedAt: new Date().toISOString(),
        citizenContact: {
          phone: normalizedContact.phone,
          email: normalizedContact.email,
          displayName: normalizedContact.displayName,
        },
      },
    };
    const aiResult = await this.ai.classify(aiInput);
    const deadlines = await this.sla.calculateDeadlines({ tenantId: tenant.id, priority: 'NORMAL' });

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        ticketNo: await this.ticketNumbers.nextTicketNo(tenant.id),
        publicTrackingToken: await this.generateTrackingToken(tenant.id),
        citizenId: citizen?.id,
        channel,
        title: dto.title ?? aiResult.classification.title,
        description: dto.description,
        addressText: dto.addressText ?? aiResult.classification.addressText ?? undefined,
        latitude: dto.latitude,
        longitude: dto.longitude,
        aiConfidence: aiResult.classification.confidence,
        aiClassification: aiResult.classification,
        ...deadlines,
        auditLogs: {
          create: [
            {
              tenantId: tenant.id,
              actorType: AuditActorType.CITIZEN,
              action: 'ticket.public_created',
              after: { channel },
            },
            {
              tenantId: tenant.id,
              actorType: AuditActorType.AI,
              action: 'ticket.ai_intake_classified',
              after: {
                provider: aiResult.provider,
                model: aiResult.model,
                promptVersion: aiResult.promptVersion,
                classification: aiResult.classification,
              },
            },
            {
              tenantId: tenant.id,
              actorType: AuditActorType.AI,
              action: 'ticket.ai_follow_up_evaluated',
              after: {
                missingFields: aiResult.classification.missingFields,
                followUpQuestion: aiResult.classification.followUpQuestion,
                citizenContact: {
                  hasPhone: Boolean(normalizedContact.phone),
                  hasEmail: Boolean(normalizedContact.email),
                  displayName: normalizedContact.displayName,
                },
              },
            },
          ],
        },
      },
      include: { department: true, category: true },
    });

    await this.attachments.attachPublicToTicket(tenant.id, ticket.id, dto.attachmentIds);
    const createdMessage = await this.templates.renderForTicket(ticket.id, 'TICKET_RECEIVED');
    if (createdMessage) {
      const message = await this.prisma.ticketMessage.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          senderType: AuditActorType.SYSTEM,
          visibility: MessageVisibility.PUBLIC,
          body: createdMessage,
          channel,
        },
      });
      await this.notifications.enqueueMessage(message.id);
    }

    return this.get(tenantSlug, ticket.publicTrackingToken ?? ticket.ticketNo);
  }

  async get(tenantSlug: string, identifier: string) {
    const ticket = await this.requirePublicTicket(tenantSlug, identifier);
    const fullTicket = await this.prisma.ticket.findFirst({
      where: { id: ticket.id },
      include: {
        category: true,
        department: true,
        messages: {
          where: { visibility: MessageVisibility.PUBLIC },
          orderBy: { createdAt: 'asc' },
          select: {
            body: true,
            createdAt: true,
            senderType: true,
            attachments: {
              where: { checksumSha256: { not: null } },
              orderBy: { createdAt: 'asc' },
              select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, scanStatus: true },
            },
          },
        },
        attachments: {
          where: { messageId: null, checksumSha256: { not: null } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
        },
      },
    });

    if (!fullTicket) throw new NotFoundException('Basvuru bulunamadi.');
    return this.toPublicTicket(fullTicket);
  }

  async addMessage(tenantSlug: string, identifier: string, dto: CreatePublicMessageDto) {
    const normalizedIdentifier = identifier.trim().toUpperCase();
    const ticket = await this.prisma.ticket.findFirst({
      where: this.publicTicketWhere(tenantSlug, normalizedIdentifier),
      include: { citizen: true },
    });

    if (!ticket) throw new NotFoundException('Basvuru bulunamadi.');
    this.requireCitizenMutableTicket(ticket.status);
    if (ticket.citizen?.phone !== dto.contact && ticket.citizen?.email !== dto.contact) {
      throw new ForbiddenException('Basvuruya mesaj eklemek icin kayitli iletisim bilgisini girin.');
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        senderType: AuditActorType.CITIZEN,
        visibility: MessageVisibility.PUBLIC,
        body: dto.body,
        channel: ticket.channel,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        actorType: AuditActorType.CITIZEN,
        action: 'ticket.citizen_public_message_added',
        after: { messageId: message.id, channel: ChannelType.CITIZEN_WEB },
      },
    });

    await this.attachments.attachPublicToMessage(ticket.tenantId, ticket.id, message.id, dto.attachmentIds);
    return this.get(tenantSlug, identifier);
  }

  private async requirePublicTicket(tenantSlug: string, identifier: string) {
    const normalizedIdentifier = identifier.trim().toUpperCase();
    const ticket = await this.prisma.ticket.findFirst({
      where: this.publicTicketWhere(tenantSlug, normalizedIdentifier),
    });

    if (!ticket) throw new NotFoundException('Basvuru bulunamadi.');
    return ticket;
  }

  private publicTicketWhere(tenantSlug: string, normalizedIdentifier: string) {
    return {
      tenant: { slug: tenantSlug, status: 'ACTIVE' },
      publicTrackingToken: normalizedIdentifier,
    };
  }

  private async generateTrackingToken(tenantId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = `TK-${randomBytes(8).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.ticket.findFirst({
        where: { tenantId, publicTrackingToken: token },
        select: { id: true },
      });
      if (!existing) return token;
    }

    throw new InternalServerErrorException('Tracking token uretilemedi: 5 denemede benzersiz token uretilmedi.');
  }

  private async listTenantDepartments(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });

    return departments;
  }

  private async listTenantCategories(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, departmentId: true },
    });

    return categories;
  }

  private requireCitizenMutableTicket(status: TicketStatus) {
    if (status === TicketStatus.CLOSED || status === TicketStatus.REJECTED) {
      throw new ForbiddenException(`${status} durumundaki basvuruya mesaj eklenemez.`);
    }
  }

  private identitySourceForChannel(channel: ChannelType) {
    if (channel === ChannelType.WEB_CHAT) return 'WEB_CHAT';
    if (channel === ChannelType.WHATSAPP) return 'WHATSAPP';
    if (channel === ChannelType.INSTAGRAM) return 'INSTAGRAM';
    if (channel === ChannelType.FACEBOOK) return 'FACEBOOK';
    if (channel === ChannelType.SMS) return 'SMS';
    if (channel === ChannelType.EMAIL) return 'EMAIL';
    return 'PUBLIC_WEB';
  }

  async registerDeviceToken(tenantSlug: string, dto: { platform: string; token: string; citizenIdentifier: string }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');

    // Find citizen by phone or email
    const identifier = await this.prisma.citizenIdentifier.findFirst({
      where: {
        tenantId: tenant.id,
        normalizedValue: dto.citizenIdentifier.trim().toLowerCase(),
      },
      select: { citizenId: true },
    });

    if (!identifier) throw new NotFoundException('Vatandaş bulunamadı');

    // Upsert device token
    await this.prisma.citizenDeviceToken.upsert({
      where: { tenantId_token: { tenantId: tenant.id, token: dto.token } },
      create: {
        tenantId: tenant.id,
        citizenId: identifier.citizenId,
        platform: dto.platform,
        token: dto.token,
        isActive: true,
      },
      update: {
        citizenId: identifier.citizenId,
        platform: dto.platform,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return { registered: true };
  }

  private toPublicTicket(ticket: {
    publicTrackingToken: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    addressText: string | null;
    resolutionDueAt: Date | null;
    createdAt: Date;
    department?: { name: string } | null;
    category?: { name: string } | null;
    messages?: Array<{
      body: string;
      createdAt: Date;
      senderType: string;
      attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: Date; scanStatus?: string | null }>;
    }>;
    attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: Date; scanStatus?: string | null }>;
  }) {
    return {
      trackingToken: ticket.publicTrackingToken,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      addressText: ticket.addressText,
      departmentName: ticket.department?.name ?? null,
      categoryName: ticket.category?.name ?? null,
      resolutionDueAt: ticket.resolutionDueAt,
      createdAt: ticket.createdAt,
      attachments: (ticket.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        createdAt: attachment.createdAt,
        scanStatus: attachment.scanStatus ?? null,
      })),
      publicMessages: (ticket.messages ?? []).map((message) => ({
        body: message.body,
        createdAt: message.createdAt,
        author: message.senderType === AuditActorType.CITIZEN ? 'citizen' : 'municipality',
        attachments: (message.attachments ?? []).map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          createdAt: attachment.createdAt,
          scanStatus: attachment.scanStatus ?? null,
        })),
      })),
    };
  }
}
