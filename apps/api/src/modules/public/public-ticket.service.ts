import { randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility, TicketStatus } from '@kentos/database';
import { buildDeterministicIntakeClassification, type PublicTicketAiIntakeRequest, type PublicTicketAiIntakeResult } from '@kentos/shared';
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
    const requestedAt = new Date().toISOString();
    const completedAt = new Date().toISOString();

    return {
      provider: 'stub',
      model: 'deterministic-fallback',
      promptVersion: 'intake-classifier.v1',
      requestedAt,
      completedAt,
      classification: buildDeterministicIntakeClassification(input),
    };
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
