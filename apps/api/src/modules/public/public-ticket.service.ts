import { randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility, TicketStatus } from '@kentos/database';
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
import { NotificationQueueService } from '../tickets/notification-queue.service.js';
import { NotificationTemplateService } from '../tickets/notification-template.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { CitizenIdentityService } from './citizen-identity.service.js';
import { CreatePublicMessageDto } from './dto/create-public-message.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';

@Injectable()
export class PublicTicketAiService {
  async classify(input: PublicTicketAiIntakeRequest): Promise<PublicTicketAiIntakeResult> {
    const request = publicTicketAiIntakeRequestSchema.parse(this.normalizeRequestContact(input));
    const requestedAt = new Date().toISOString();
    const netivaConfig = this.readNetivaConfig();

    if (netivaConfig.enabled) {
      try {
        return await this.classifyWithNetiva(request, requestedAt, netivaConfig);
      } catch {
        // AI intake must not block public ticket creation; keep the deterministic path as a safe fallback.
      }
    }

    return this.classifyWithDeterministicFallback(request, requestedAt);
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
  ): Promise<PublicTicketAiIntakeResult> {
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
        max_tokens: config.maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Netiva AI request failed with ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null }; text?: string | null }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
    if (!content) throw new Error('Netiva AI response did not include content');

    return publicTicketAiIntakeResultSchema.parse({
      provider: 'netiva',
      model: config.model,
      promptVersion: 'intake-classifier.v1',
      requestedAt,
      completedAt: new Date().toISOString(),
      classification: this.parseClassification(content),
    });
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
          select: { body: true, createdAt: true, senderType: true },
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

    throw new Error('Tracking token uretilemedi.');
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
    return 'PUBLIC_WEB';
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
    messages?: Array<{ body: string; createdAt: Date; senderType: string }>;
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
      publicMessages: (ticket.messages ?? []).map((message) => ({
        body: message.body,
        createdAt: message.createdAt,
        author: message.senderType === AuditActorType.CITIZEN ? 'citizen' : 'municipality',
      })),
    };
  }
}
