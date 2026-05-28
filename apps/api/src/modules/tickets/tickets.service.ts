import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility, OutboundDeliveryState, TicketStatus, UserRole } from '@kentos/database';
import type { Prisma } from '@kentos/database';
import { intakeClassificationSchema } from '@kentos/shared';
import type { IntakeClassification } from '@kentos/shared';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { CsatQueueService } from './csat-queue.service.js';
import { GeocodeQueueService } from './geocode-queue.service.js';
import { NeighborhoodRoutingService } from './neighborhood-routing.service.js';
import { NotificationQueueService } from './notification-queue.service.js';
import { NotificationTemplateService } from './notification-template.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { SuggestReplyDto } from './dto/suggest-reply.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { FcmPushService } from './fcm-push.service.js';
import { SlaService } from './sla.service.js';
import { TicketAiService } from './ticket-ai.service.js';
import { TicketNumberService } from './ticket-number.service.js';
import { EventsService } from '../events/events.service.js';
import { WebhookQueueService } from '../tenants/webhook-queue.service.js';

@Injectable()
export class TicketsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationQueueService) private readonly notifications: NotificationQueueService,
    @Inject(NotificationTemplateService) private readonly templates: NotificationTemplateService,
    @Inject(SlaService) private readonly sla: SlaService,
    @Inject(TicketNumberService) private readonly ticketNumbers: TicketNumberService,
    @Inject(AttachmentsService) private readonly attachments: AttachmentsService,
    @Inject(CsatQueueService) private readonly csatQueue: CsatQueueService,
    @Inject(NeighborhoodRoutingService) private readonly neighborhoodRouting: NeighborhoodRoutingService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Inject(TicketAiService) private readonly ticketAi: TicketAiService,
    @Inject(FcmPushService) private readonly fcmPush: FcmPushService,
    @Inject(WebhookQueueService) private readonly webhooks: WebhookQueueService,
    @Inject(GeocodeQueueService) private readonly geocodeQueue: GeocodeQueueService,
  ) {}

  suggestReply(user: AuthenticatedUser, ticketId: string, dto: SuggestReplyDto) {
    return this.ticketAi.suggestReply(user.tenantId, ticketId, dto.operatorNote);
  }

  async smartAssign(user: AuthenticatedUser, id: string) {
    const ticket = await this.requireTicket(user, id);
    this.requireMutableTicket(ticket.status);

    if (!ticket.departmentId) {
      throw new BadRequestException('Ticket bir birime atanmamis, once birim belirleyin.');
    }

    // Find active operators in the same department ordered by open ticket count
    const staffInDept = await this.prisma.userDepartment.findMany({
      where: { departmentId: ticket.departmentId, user: { tenantId: user.tenantId, isActive: true } },
      select: { userId: true, user: { select: { fullName: true, email: true, role: true } } },
    });

    if (!staffInDept.length) {
      throw new BadRequestException('Bu birimde aktif personel bulunamadi.');
    }

    const openCountMap = await this.prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: {
        tenantId: user.tenantId,
        assignedToId: { in: staffInDept.map((s) => s.userId) },
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.REJECTED] },
      },
      _count: { _all: true },
    });

    const countByUser = new Map(openCountMap.map((row) => [row.assignedToId, row._count._all]));
    const best = staffInDept.sort((a, b) => (countByUser.get(a.userId) ?? 0) - (countByUser.get(b.userId) ?? 0))[0];

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: best.userId,
        status: ticket.status === TicketStatus.NEW || ticket.status === TicketStatus.TRIAGED ? TicketStatus.ASSIGNED : ticket.status,
        auditLogs: {
          create: {
            tenantId: user.tenantId,
            actorType: AuditActorType.SYSTEM,
            actorUserId: user.id,
            action: 'ticket.smart_assigned',
            before: { assignedToId: ticket.assignedToId },
            after: { assignedToId: best.userId, reason: 'min_open_tickets' },
          },
        },
      },
    });

    this.eventsService.emit({ type: 'ticket.assigned', tenantId: user.tenantId, payload: { ticketId: id, assignedToId: best.userId } });

    return { ticketId: id, assignedToId: best.userId, assignedToName: best.user.fullName, openTickets: countByUser.get(best.userId) ?? 0 };
  }

  async suggestPriority(user: AuthenticatedUser, id: string) {
    const ticket = await this.requireTicket(user, id);

    const keywords: Record<string, string> = {
      acil: 'URGENT', aciliyet: 'URGENT', tehlike: 'URGENT', yangın: 'URGENT', yangin: 'URGENT',
      sel: 'URGENT', kaza: 'HIGH', yara: 'HIGH', döküntü: 'HIGH', patlama: 'HIGH',
      şikayet: 'NORMAL', talep: 'NORMAL', istek: 'NORMAL', öneri: 'LOW', bilgi: 'LOW',
    };

    const text = `${ticket.title} ${ticket.description}`.toLowerCase();
    let suggestedPriority = 'NORMAL';
    for (const [keyword, priority] of Object.entries(keywords)) {
      if (text.includes(keyword)) {
        suggestedPriority = priority;
        if (priority === 'URGENT') break;
      }
    }

    const priorityOrder = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    const currentIndex = priorityOrder.indexOf(ticket.priority);
    const suggestedIndex = priorityOrder.indexOf(suggestedPriority);
    const confidence = suggestedIndex !== currentIndex ? 0.7 : 0.9;

    return {
      ticketId: id,
      currentPriority: ticket.priority,
      suggestedPriority,
      confidence,
      reason: suggestedIndex > currentIndex
        ? `Tahmin edilen "${suggestedPriority}" mevcut "${ticket.priority}" değerinden daha yüksek — içerik analizi ile belirlendi.`
        : suggestedIndex < currentIndex
        ? `Tahmin edilen "${suggestedPriority}" mevcut "${ticket.priority}" değerinden daha düşük.`
        : 'Mevcut öncelik uygun görünüyor.',
    };
  }

  async list(
    user: AuthenticatedUser,
    filters: {
      status?: TicketStatus;
      departmentId?: string;
      categoryId?: string;
      assignedToId?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

    const departmentScope = await this.departmentScope(user);
    const where = {
      tenantId: user.tenantId,
      status: filters.status,
      departmentId: this.scopedDepartmentFilter(departmentScope, filters.departmentId),
      categoryId: filters.categoryId,
      assignedToId: filters.assignedToId,
      OR: filters.q
        ? [
            { ticketNo: { contains: filters.q, mode: 'insensitive' as const } },
            { publicTrackingToken: { contains: filters.q, mode: 'insensitive' as const } },
            { title: { contains: filters.q, mode: 'insensitive' as const } },
            { description: { contains: filters.q, mode: 'insensitive' as const } },
            { addressText: { contains: filters.q, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { department: true, category: true, assignedTo: true, citizen: true },
        orderBy: [{ createdAt: 'desc' }, { resolutionDueAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets.map((ticket) => ({ ...ticket, slaState: this.slaState(ticket.resolutionDueAt) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    if (!Object.values(ChannelType).includes(dto.channel)) {
      throw new BadRequestException('Kanal degeri gecersiz.');
    }
    if (typeof dto.title !== 'string' || dto.title.trim().length < 3) {
      throw new BadRequestException('Baslik en az 3 karakter olmalidir.');
    }
    if (typeof dto.description !== 'string' || dto.description.trim().length < 10) {
      throw new BadRequestException('Aciklama en az 10 karakter olmalidir.');
    }

    const relations = await this.validateTicketRelations(user.tenantId, dto);

    // F4: GIS routing — if lat/lon provided and no explicit departmentId, resolve via polygon
    let resolvedDepartmentId = relations.departmentId;
    let resolvedNeighborhoodId: string | undefined;
    if (dto.latitude != null && dto.longitude != null && !relations.departmentId) {
      const match = await this.neighborhoodRouting.resolveNeighborhood(
        Number(dto.latitude),
        Number(dto.longitude),
        user.tenantId,
      );
      if (match) {
        resolvedNeighborhoodId = match.id;
        if (match.departmentId) resolvedDepartmentId = match.departmentId;
      }
    }

    await this.requireDepartmentScope(user, resolvedDepartmentId);

    const priority = dto.priority ?? 'NORMAL';
    const deadlines = await this.sla.calculateDeadlines({
      tenantId: user.tenantId,
      priority,
      departmentId: resolvedDepartmentId,
      categoryId: relations.categoryId,
    });

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId: user.tenantId,
        ticketNo: await this.ticketNumbers.nextTicketNo(user.tenantId),
        channel: dto.channel,
        title: dto.title,
        description: dto.description,
        priority,
        categoryId: relations.categoryId,
        departmentId: resolvedDepartmentId,
        neighborhoodId: resolvedNeighborhoodId,
        citizenId: relations.citizenId,
        addressText: dto.addressText,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ...deadlines,
        auditLogs: {
          create: {
            tenantId: user.tenantId,
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            action: 'ticket.created',
            after: { ...dto, _gisRouted: !!resolvedNeighborhoodId },
          },
        },
      },
      include: { auditLogs: true },
    });

    await this.attachments.attachAdminToTicket(user, ticket.id, dto.attachmentIds);

    // Enqueue reverse geocoding if coordinates provided but no address text
    if (dto.latitude != null && dto.longitude != null && !dto.addressText) {
      void this.geocodeQueue.enqueue(ticket.id, Number(dto.latitude), Number(dto.longitude));
    }

    this.eventsService.emit({
      type: 'ticket.created',
      tenantId: user.tenantId,
      payload: { ticketId: ticket.id, ticketNo: ticket.ticketNo, status: ticket.status, priority: ticket.priority },
    });

    void this.webhooks.dispatchEvent(user.tenantId, 'ticket.created', {
      ticketId: ticket.id, ticketNo: ticket.ticketNo, status: ticket.status, priority: ticket.priority,
    });

    // F9: Duplicate detection — link to an existing open ticket from the same citizen if similar title in last 48h
    if (relations.citizenId) {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const duplicate = await this.prisma.ticket.findFirst({
        where: {
          tenantId: user.tenantId,
          citizenId: relations.citizenId,
          id: { not: ticket.id },
          createdAt: { gte: since48h },
          status: { notIn: [TicketStatus.CLOSED, TicketStatus.REJECTED] },
        },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
      });
      if (duplicate && this.isSimilarTitle(ticket.title, duplicate.title)) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { duplicateOfTicketId: duplicate.id },
        });
      }
    }

    return ticket;
  }

  private isSimilarTitle(a: string, b: string): boolean {
    // Simple word-overlap similarity: > 60% shared words → probable duplicate
    const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const wa = words(a);
    const wb = words(b);
    if (wa.size === 0 || wb.size === 0) return false;
    let overlap = 0;
    for (const w of wa) { if (wb.has(w)) overlap++; }
    const similarity = overlap / Math.max(wa.size, wb.size);
    return similarity >= 0.6;
  }

  async get(user: AuthenticatedUser, id: string) {
    const departmentScope = await this.departmentScope(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId: user.tenantId, departmentId: this.scopedDepartmentFilter(departmentScope) },
      include: {
        auditLogs: { orderBy: { createdAt: 'desc' } },
        attachments: true,
        category: true,
        citizen: true,
        department: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: true },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Talep bulunamadi.');

    const followUpAudit = ticket.auditLogs.find((item) => item.action === 'ticket.ai_follow_up_evaluated');
    const followUpAfter = this.asRecord(followUpAudit?.after);
    const contactSignals = this.asRecord(followUpAfter?.citizenContact);

    return {
      ...ticket,
      aiSummary: {
        confidence: ticket.aiConfidence ? Number(ticket.aiConfidence) : null,
        // safeParse ile DB'den gelen JSON'ı doğrula — geçersiz veri null döner
        classification: intakeClassificationSchema.safeParse(ticket.aiClassification).data ?? null,
        contactSignals: contactSignals
          ? {
              hasPhone: Boolean(contactSignals.hasPhone),
              hasEmail: Boolean(contactSignals.hasEmail),
              displayName: typeof contactSignals.displayName === 'string' ? contactSignals.displayName : null,
            }
          : null,
      },
    };
  }

  async assign(user: AuthenticatedUser, id: string, dto: AssignTicketDto) {
    const ticket = await this.requireTicket(user, id);
    this.requireMutableTicket(ticket.status);
    const department = await this.requireDepartment(user.tenantId, dto.departmentId);
    await this.requireDepartmentScope(user, dto.departmentId);
    if (dto.assignedToId) await this.requireAssignableUser(user.tenantId, dto.assignedToId, dto.departmentId);
    const shouldCreatePublicRoutingMessage = this.shouldCreatePublicRoutingMessage(ticket, dto.departmentId);
    const routedMessage = shouldCreatePublicRoutingMessage
      ? await this.templates.renderForTicket(ticket.id, 'TICKET_ROUTED', { departmentName: department.name })
      : null;

    const updatedTicket = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: ticket.status === TicketStatus.NEW || ticket.status === TicketStatus.TRIAGED ? TicketStatus.ASSIGNED : ticket.status,
        departmentId: dto.departmentId,
        assignedToId: dto.assignedToId,
        messages: routedMessage
          ? {
              create: {
                tenantId: user.tenantId,
                senderType: AuditActorType.SYSTEM,
                visibility: MessageVisibility.PUBLIC,
                body: routedMessage,
                channel: ticket.channel,
              },
            }
          : undefined,
        auditLogs: {
          create: {
            tenantId: user.tenantId,
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            action: 'ticket.assigned',
            before: { departmentId: ticket.departmentId, assignedToId: ticket.assignedToId, status: ticket.status },
            after: { departmentId: dto.departmentId, assignedToId: dto.assignedToId ?? null },
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const latestPublicMessageId = routedMessage ? updatedTicket.messages?.[0]?.id : undefined;
    if (latestPublicMessageId) await this.notifications.enqueueMessage(latestPublicMessageId);

    this.eventsService.emit({
      type: 'ticket.assigned',
      tenantId: user.tenantId,
      payload: { ticketId: id, departmentId: dto.departmentId, assignedToId: dto.assignedToId ?? null },
    });

    void this.webhooks.dispatchEvent(user.tenantId, 'ticket.assigned', {
      ticketId: id, departmentId: dto.departmentId, assignedToId: dto.assignedToId ?? null,
    });

    return updatedTicket;
  }

  private shouldCreatePublicRoutingMessage(
    ticket: { departmentId: string | null | undefined },
    nextDepartmentId: string,
  ) {
    return ticket.departmentId !== nextDepartmentId;
  }

  async addInternalNote(user: AuthenticatedUser, id: string, dto: CreateTicketMessageDto) {
    const ticket = await this.requireTicket(user, id);
    this.requireMutableTicket(ticket.status);

    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId: user.tenantId,
        ticketId: id,
        senderType: AuditActorType.USER,
        senderId: user.id,
        visibility: MessageVisibility.INTERNAL,
        body: dto.body,
      },
    });

    await this.audit(user, id, 'ticket.internal_note_added', undefined, { messageId: message.id });
    await this.attachments.attachAdminToMessage(user, id, message.id, dto.attachmentIds);

    // 3.3 — @mention notifications
    void this.notifyMentions(user, id, dto.body);

    this.eventsService.emit({
      type: 'ticket.message_added',
      tenantId: user.tenantId,
      payload: { ticketId: id, messageId: message.id, visibility: 'INTERNAL' },
    });

    return message;
  }

  async addPublicMessage(user: AuthenticatedUser, id: string, dto: CreateTicketMessageDto) {
    const ticket = await this.requireTicket(user, id);
    this.requireMutableTicket(ticket.status);

    const message = await this.prisma.ticketMessage.create({
      data: {
        tenantId: user.tenantId,
        ticketId: id,
        senderType: AuditActorType.USER,
        senderId: user.id,
        visibility: MessageVisibility.PUBLIC,
        channel: ticket.channel,
        body: dto.body,
      },
    });

    await this.audit(user, id, 'ticket.public_message_added', undefined, { messageId: message.id });
    await this.attachments.attachAdminToMessage(user, id, message.id, dto.attachmentIds);
    await this.notifications.enqueueMessage(message.id);

    // FCM push — public staff reply
    void this.sendPublicReplyPush(ticket);

    this.eventsService.emit({
      type: 'ticket.message_added',
      tenantId: user.tenantId,
      payload: { ticketId: id, messageId: message.id, visibility: 'PUBLIC' },
    });

    return message;
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.requireTicket(user, id);
    if (!this.canTransition(ticket.status, dto.status)) {
      throw new ForbiddenException(`${ticket.status} durumundan ${dto.status} durumuna gecis desteklenmiyor.`);
    }

    const fallbackTemplateKey = this.statusTemplateKey(dto.status);
    const fallbackPublicMessage = dto.publicMessage
      ? null
      : fallbackTemplateKey
        ? await this.templates.renderForTicket(ticket.id, fallbackTemplateKey)
        : null;
    const now = new Date();
    const shouldCreatePublicMessage = Boolean(dto.publicMessage || fallbackPublicMessage);
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        firstRespondedAt: ticket.firstRespondedAt ?? (dto.status !== TicketStatus.NEW ? now : null),
        resolvedAt: dto.status === TicketStatus.RESOLVED ? now : ticket.resolvedAt,
        closedAt: dto.status === TicketStatus.CLOSED ? now : ticket.closedAt,
        messages: dto.publicMessage || fallbackPublicMessage
          ? {
              create: {
                tenantId: user.tenantId,
                senderType: dto.publicMessage ? AuditActorType.USER : AuditActorType.SYSTEM,
                senderId: dto.publicMessage ? user.id : undefined,
                visibility: MessageVisibility.PUBLIC,
                body: dto.publicMessage ?? fallbackPublicMessage ?? '',
                channel: ticket.channel,
              },
            }
          : undefined,
        auditLogs: {
          create: {
            tenantId: user.tenantId,
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            action: 'ticket.status_changed',
            before: { status: ticket.status },
            after: { status: dto.status },
          },
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const latestPublicMessageId = shouldCreatePublicMessage ? updated.messages?.[0]?.id : undefined;
    if (latestPublicMessageId) await this.notifications.enqueueMessage(latestPublicMessageId);
    if (dto.status === TicketStatus.RESOLVED) {
      void this.csatQueue.enqueueCsat(id, user.tenantId);
    }

    this.eventsService.emit({
      type: 'ticket.updated',
      tenantId: user.tenantId,
      payload: { ticketId: id, status: dto.status },
    });

    const webhookEvent = dto.status === 'RESOLVED' ? 'ticket.resolved' : dto.status === 'CLOSED' ? 'ticket.closed' : 'ticket.updated';
    void this.webhooks.dispatchEvent(user.tenantId, webhookEvent, { ticketId: id, status: dto.status });

    // FCM push notification — fire-and-forget, does not block response
    void this.sendStatusPush(ticket, dto.status);

    return updated;
  }

  async auditLog(user: AuthenticatedUser, id: string) {
    await this.requireTicket(user, id);
    return this.prisma.auditLog.findMany({ where: { tenantId: user.tenantId, ticketId: id }, orderBy: { createdAt: 'desc' } });
  }

  async listHandoffs(user: AuthenticatedUser) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId: user.tenantId,
        handoffRequested: true,
      },
      include: {
        citizen: true,
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return conversations.map((conversation) => this.toHandoffSummary(conversation));
  }

  async getHandoff(user: AuthenticatedUser, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        handoffRequested: true,
      },
      include: {
        citizen: true,
      },
    });

    if (!conversation) throw new NotFoundException('Operator devri bekleyen konusma bulunamadi.');
    return this.toHandoffDetail(conversation);
  }

  async createTicketFromHandoff(user: AuthenticatedUser, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
      include: {
        citizen: true,
      },
    });

    if (!conversation) throw new NotFoundException('Operator devri bekleyen konusma bulunamadi.');

    const context = this.readConversationContext(conversation.context);
    const latestClassification = this.asRecord(context.latestClassification);
    const contact = this.readConversationContact(context.contact);
    const existingTicket = this.asRecord(context.ticket);

    const existingTicketRecord = await this.findConversationTicket(user.tenantId, existingTicket);
    if (existingTicketRecord) {
      return {
        ticketId: existingTicketRecord.id,
        ticketNo: existingTicketRecord.ticketNo,
        trackingToken: existingTicketRecord.publicTrackingToken,
      };
    }

    if (!conversation.handoffRequested) throw new NotFoundException('Operator devri bekleyen konusma bulunamadi.');

    const title = typeof latestClassification?.title === 'string' && latestClassification.title.trim().length >= 3
      ? latestClassification.title.trim()
      : 'Operator devri talebi';
    const description = typeof latestClassification?.description === 'string' && latestClassification.description.trim().length >= 10
      ? latestClassification.description.trim()
      : this.readConversationMessages(context.messages)
          .filter((message) => message.role === 'citizen')
          .map((message) => message.text.trim())
          .filter(Boolean)
          .join('\n\n')
          .slice(0, 5000);

    if (!description || description.length < 10) {
      throw new ForbiddenException('Bu konusmadan ticket olusturmak icin yeterli aciklama yok.');
    }

    const ticket = await this.create(user, {
      channel: conversation.channel as ChannelType,
      title,
      description,
      addressText: typeof latestClassification?.addressText === 'string' ? latestClassification.addressText : undefined,
      citizenId: conversation.citizenId ?? undefined,
    });

    const nextContext: Prisma.InputJsonValue = {
      ...context,
      ticket: {
        ticketId: ticket.id,
        ticketNo: ticket.ticketNo,
        trackingToken: ticket.publicTrackingToken,
        createdAt: new Date().toISOString(),
        source: 'operator_handoff',
      },
      contact: {
        displayName: conversation.citizen?.displayName ?? contact.displayName,
        phone: conversation.citizen?.phone ?? contact.phone,
        email: conversation.citizen?.email ?? contact.email,
      },
    };

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        context: nextContext,
        handoffRequested: false,
        state: 'TICKET_CREATED',
        lastMessageAt: conversation.lastMessageAt ?? new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        ticketId: ticket.id,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        action: 'ticket.created_from_handoff',
        after: {
          conversationId: conversation.id,
          channel: conversation.channel,
          citizen: {
            displayName: conversation.citizen?.displayName ?? contact.displayName,
            phone: conversation.citizen?.phone ?? contact.phone,
            email: conversation.citizen?.email ?? contact.email,
          },
        },
      },
    });

    return {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      trackingToken: ticket.publicTrackingToken,
    };
  }

  private async findConversationTicket(tenantId: string, ticketContext: Record<string, unknown> | null) {
    const ticketId = typeof ticketContext?.ticketId === 'string' ? ticketContext.ticketId : null;
    const trackingToken = typeof ticketContext?.trackingToken === 'string' ? ticketContext.trackingToken : null;

    if (!ticketId && !trackingToken) return null;

    return this.prisma.ticket.findFirst({
      where: {
        tenantId,
        OR: [
          ...(ticketId ? [{ id: ticketId }] : []),
          ...(trackingToken ? [{ publicTrackingToken: trackingToken }] : []),
        ],
      },
      select: {
        id: true,
        ticketNo: true,
        publicTrackingToken: true,
      },
    });
  }

  private async requireTicket(user: AuthenticatedUser, id: string) {
    const departmentScope = await this.departmentScope(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId: user.tenantId, departmentId: this.scopedDepartmentFilter(departmentScope) },
    });
    if (!ticket) throw new NotFoundException('Talep bulunamadi.');
    return ticket;
  }

  private async departmentScope(user: AuthenticatedUser) {
    if (user.role !== UserRole.DEPARTMENT_STAFF) return undefined;
    const departments = await this.prisma.userDepartment.findMany({
      where: { userId: user.id, department: { tenantId: user.tenantId, isActive: true } },
      select: { departmentId: true },
    });
    return departments.map((department) => department.departmentId);
  }

  private scopedDepartmentFilter(departmentScope?: string[], requestedDepartmentId?: string): Prisma.StringNullableFilter | string | undefined {
    if (!departmentScope) return requestedDepartmentId;
    if (requestedDepartmentId) return departmentScope.includes(requestedDepartmentId) ? requestedDepartmentId : { in: [] };
    return { in: departmentScope };
  }

  private async requireDepartmentScope(user: AuthenticatedUser, departmentId?: string | null) {
    const departmentScope = await this.departmentScope(user);
    if (!departmentScope) return;
    if (!departmentId || !departmentScope.includes(departmentId)) throw new ForbiddenException('Bu birim icin islem yetkiniz yok.');
  }

  private async requireDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId, isActive: true } });
    if (!department) throw new NotFoundException('Birim bulunamadi.');
    return department;
  }

  private async requireCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tenantId, isActive: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadi.');
    return category;
  }

  private async requireCitizen(tenantId: string, citizenId: string) {
    const citizen = await this.prisma.citizen.findFirst({
      where: { id: citizenId, tenantId },
    });
    if (!citizen) throw new NotFoundException('Vatandas bulunamadi.');
    return citizen;
  }

  private async requireAssignableUser(tenantId: string, userId: string, departmentId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      include: { departments: true },
    });
    if (!user) throw new NotFoundException('Kullanici bulunamadi.');
    if (user.role === UserRole.DEPARTMENT_STAFF && !user.departments.some((department) => department.departmentId === departmentId)) {
      throw new ForbiddenException('Kullanici bu birime atanamaz.');
    }
    return user;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  }

  private async notifyMentions(actor: AuthenticatedUser, ticketId: string, body: string) {
    const handles = [...body.matchAll(/@(\S+)/g)].map((m) => m[1]).filter(Boolean);
    if (!handles.length) return;
    try {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          id: { not: actor.id },
          OR: handles.flatMap((h) => [
            { email: { startsWith: h, mode: 'insensitive' as const } },
            { fullName: { contains: h, mode: 'insensitive' as const } },
          ]),
        },
        select: { id: true, fullName: true },
      });
      if (!users.length) return;
      // Staff FCM push is gated behind UserDeviceToken table (planned future migration)
      // For now emit SSE event so the frontend can react
      for (const u of users) {
        this.eventsService.emit({
          type: 'ticket.mention' as never,
          tenantId: actor.tenantId,
          payload: { ticketId, mentionedUserId: u.id },
        });
      }
    } catch { /* mention notification failure must never break the response */ }
  }

  private async sendPublicReplyPush(ticket: { id: string; tenantId: string; title: string; citizenId: string | null }) {
    if (!ticket.citizenId) return;
    try {
      const deviceTokens = await this.prisma.citizenDeviceToken.findMany({
        where: { tenantId: ticket.tenantId, citizenId: ticket.citizenId, isActive: true },
        select: { token: true },
      });
      const tokens = deviceTokens.map((dt) => dt.token);
      await this.fcmPush.sendToMany(tokens, 'Talebinize yanıt geldi', ticket.title, { ticketId: ticket.id, event: 'new_reply' });
    } catch { /* push failure must never break the response */ }
  }

  private async sendStatusPush(ticket: { id: string; tenantId: string; title: string; citizenId: string | null }, newStatus: string) {
    if (!ticket.citizenId) return;
    const statusNotifyMap: Record<string, string> = {
      RESOLVED: 'Talebiniz cozuldu',
      CLOSED: 'Talebiniz kapatildi',
      IN_PROGRESS: 'Talebiniz isleme alindi',
      WAITING_INFO: 'Talebiniz icin bilgi bekleniyor',
    };
    const title = statusNotifyMap[newStatus];
    if (!title) return;

    try {
      const deviceTokens = await this.prisma.citizenDeviceToken.findMany({
        where: { tenantId: ticket.tenantId, citizenId: ticket.citizenId, isActive: true },
        select: { token: true },
      });
      const tokens = deviceTokens.map((dt) => dt.token);
      await this.fcmPush.sendToMany(tokens, title, ticket.title, { ticketId: ticket.id, status: newStatus });
    } catch { /* push failure must never break the response */ }
  }

  private toHandoffSummary(conversation: {
    id: string;
    channel: string;
    state: string;
    handoffRequested: boolean;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    externalConversationId: string | null;
    citizen: { displayName: string | null; phone: string | null; email: string | null } | null;
    context: unknown;
  }) {
    const context = this.readConversationContext(conversation.context);
    const messages = this.readConversationMessages(context.messages);
    const contact = this.readConversationContact(context.contact);
    const latestClassification = this.asRecord(context.latestClassification);
    const latestCitizenMessage = [...messages].reverse().find((message) => message.role === 'citizen')?.text ?? null;
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')?.text ?? null;
    const ticket = this.asRecord(context.ticket);

    return {
      id: conversation.id,
      channel: conversation.channel,
      state: conversation.state,
      handoffRequested: conversation.handoffRequested,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      externalConversationId: conversation.externalConversationId,
      citizen: {
        displayName: conversation.citizen?.displayName ?? contact.displayName,
        phone: conversation.citizen?.phone ?? contact.phone,
        email: conversation.citizen?.email ?? contact.email,
      },
      latestIntent: typeof latestClassification?.intent === 'string' ? latestClassification.intent : null,
      latestCitizenMessage,
      latestAssistantMessage,
      trackingToken: typeof ticket?.trackingToken === 'string' ? ticket.trackingToken : null,
      messageCount: messages.length,
    };
  }

  private toHandoffDetail(conversation: {
    id: string;
    channel: string;
    state: string;
    handoffRequested: boolean;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    externalConversationId: string | null;
    citizen: { displayName: string | null; phone: string | null; email: string | null } | null;
    context: unknown;
  }) {
    const summary = this.toHandoffSummary(conversation);
    const context = this.readConversationContext(conversation.context);
    const latestClassification = this.asRecord(context.latestClassification);
    const missingFields = Array.isArray(latestClassification?.missingFields)
      ? latestClassification.missingFields.filter((field): field is string => typeof field === 'string')
      : [];

    return {
      ...summary,
      followUpQuestion: typeof latestClassification?.followUpQuestion === 'string' ? latestClassification.followUpQuestion : null,
      classificationTitle: typeof latestClassification?.title === 'string' ? latestClassification.title : null,
      classificationDescription: typeof latestClassification?.description === 'string' ? latestClassification.description : null,
      missingFields,
      messages: this.readConversationMessages(context.messages),
    };
  }

  private readConversationContext(value: unknown) {
    return this.asRecord(value) ?? {};
  }

  private readConversationContact(value: unknown) {
    const contact = this.asRecord(value);
    return {
      displayName: typeof contact?.displayName === 'string' ? contact.displayName : null,
      phone: typeof contact?.phone === 'string' ? contact.phone : null,
      email: typeof contact?.email === 'string' ? contact.email : null,
    };
  }

  private readConversationMessages(value: unknown) {
    if (!Array.isArray(value)) return [] as Array<{ role: 'citizen' | 'assistant'; text: string; at: string | null }>;

    return value.flatMap((message) => {
      const item = this.asRecord(message);
      const role = item?.role;
      const text = item?.text;
      const at = item?.at;
      if ((role !== 'citizen' && role !== 'assistant') || typeof text !== 'string') return [];
      return [{ role, text, at: typeof at === 'string' ? at : null }];
    });
  }

  private audit(user: AuthenticatedUser, ticketId: string, action: string, before?: Prisma.InputJsonValue, after?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        ticketId,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        action,
        before,
        after,
      },
    });
  }

  private requireMutableTicket(status: TicketStatus) {
    if (status === TicketStatus.CLOSED || status === TicketStatus.REJECTED) {
      throw new ForbiddenException(`${status} durumundaki talep degistirilemez.`);
    }
  }

  private async validateTicketRelations(tenantId: string, dto: CreateTicketDto) {
    const [department, category, citizen] = await Promise.all([
      dto.departmentId ? this.requireDepartment(tenantId, dto.departmentId) : Promise.resolve(null),
      dto.categoryId ? this.requireCategory(tenantId, dto.categoryId) : Promise.resolve(null),
      dto.citizenId ? this.requireCitizen(tenantId, dto.citizenId) : Promise.resolve(null),
    ]);

    if (category?.departmentId && department && category.departmentId !== department.id) {
      throw new ForbiddenException('Kategori secilen birime ait degil.');
    }

    return {
      departmentId: department?.id,
      categoryId: category?.id,
      citizenId: citizen?.id,
    };
  }

  private slaState(resolutionDueAt: Date | null) {
    if (!resolutionDueAt) return 'UNKNOWN';
    const diffMs = resolutionDueAt.getTime() - Date.now();
    if (diffMs < 0) return 'BREACHED';
    if (diffMs <= 4 * 60 * 60 * 1000) return 'DUE_SOON';
    return 'OK';
  }

  private canTransition(from: TicketStatus, to: TicketStatus) {
    const transitions: Record<TicketStatus, TicketStatus[]> = {
      NEW: [TicketStatus.TRIAGED, TicketStatus.ASSIGNED, TicketStatus.REJECTED],
      TRIAGED: [TicketStatus.ASSIGNED, TicketStatus.WAITING_INFO, TicketStatus.REJECTED],
      ASSIGNED: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_INFO, TicketStatus.REJECTED],
      IN_PROGRESS: [TicketStatus.WAITING_INFO, TicketStatus.RESOLVED, TicketStatus.REJECTED],
      WAITING_INFO: [TicketStatus.TRIAGED, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.REJECTED],
      RESOLVED: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
      CLOSED: [],
      REJECTED: [],
    };

    return from === to || transitions[from].includes(to);
  }

  private statusTemplateKey(status: TicketStatus) {
    const templateKeys: Partial<Record<TicketStatus, string>> = {
      ASSIGNED: 'TICKET_ROUTED',
      IN_PROGRESS: 'TICKET_IN_PROGRESS',
      RESOLVED: 'TICKET_RESOLVED',
    };

    return templateKeys[status] ?? null;
  }

  async bulkAssign(user: AuthenticatedUser, dto: { ticketIds: string[]; assignedToId: string }) {
    // Validate assignedToId belongs to same tenant
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, tenantId: user.tenantId, isActive: true },
    });
    if (!assignee) throw new NotFoundException(`User ${dto.assignedToId} not found in tenant`);

    // Only operate on tickets belonging to this tenant
    const tickets = await this.prisma.ticket.findMany({
      where: { id: { in: dto.ticketIds }, tenantId: user.tenantId },
      select: { id: true, assignedToId: true },
    });

    const ids = tickets.map((t) => t.id);
    if (ids.length === 0) return { updated: 0, skipped: dto.ticketIds.length };

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.ticket.updateMany({
        where: { id: { in: ids }, tenantId: user.tenantId },
        data: { assignedToId: dto.assignedToId, status: 'ASSIGNED' as TicketStatus },
      });
      await tx.auditLog.createMany({
        data: ids.map((ticketId: string) => ({
          tenantId: user.tenantId,
          ticketId,
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: 'ticket.bulk_assigned',
          after: { assignedToId: dto.assignedToId },
        })),
      });
    });

    return { updated: ids.length, skipped: dto.ticketIds.length - ids.length };
  }

  async bulkUpdateStatus(user: AuthenticatedUser, dto: { ticketIds: string[]; status: TicketStatus }) {
    const tickets = await this.prisma.ticket.findMany({
      where: { id: { in: dto.ticketIds }, tenantId: user.tenantId },
      select: { id: true, status: true },
    });

    const ids = tickets.map((t) => t.id);
    if (ids.length === 0) return { updated: 0, skipped: dto.ticketIds.length };

    const now = new Date();
    const extraData: Record<string, unknown> = {};
    if (dto.status === 'RESOLVED') extraData.resolvedAt = now;
    if (dto.status === 'CLOSED') extraData.closedAt = now;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.ticket.updateMany({
        where: { id: { in: ids }, tenantId: user.tenantId },
        data: { status: dto.status, ...extraData },
      });
      await tx.auditLog.createMany({
        data: ids.map((ticketId: string) => ({
          tenantId: user.tenantId,
          ticketId,
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: 'ticket.bulk_status_changed',
          after: { status: dto.status },
        })),
      });
    });

    return { updated: ids.length, skipped: dto.ticketIds.length - ids.length };
  }

  // 3.2 — Ticket tag attach / detach (use raw SQL for _TicketTags junction; Prisma client not yet regenerated)
  async attachTag(user: AuthenticatedUser, ticketId: string, tagId: string) {
    await this.requireTicket(user, ticketId);
    const tags = await this.prisma.$queryRaw<Array<{ id: string; name: string }>>`SELECT "id", "name" FROM "TicketTag" WHERE "id" = ${tagId} AND "tenantId" = ${user.tenantId} LIMIT 1`;
    if (!tags.length) throw new NotFoundException('Etiket bulunamadi.');
    await this.prisma.$executeRaw`INSERT INTO "_TicketTags" ("A","B") VALUES (${ticketId},${tagId}) ON CONFLICT DO NOTHING`;
    await this.audit(user, ticketId, 'ticket.tag_attached', undefined, { tagId, tagName: tags[0]!.name });
    return { ok: true };
  }

  async detachTag(user: AuthenticatedUser, ticketId: string, tagId: string) {
    await this.requireTicket(user, ticketId);
    await this.prisma.$executeRaw`DELETE FROM "_TicketTags" WHERE "A" = ${ticketId} AND "B" = ${tagId}`;
    await this.audit(user, ticketId, 'ticket.tag_detached', undefined, { tagId });
    return { ok: true };
  }

  // 3.4 — Watchers
  async watchTicket(user: AuthenticatedUser, id: string) {
    await this.requireTicket(user, id);
    await this.prisma.$executeRaw`INSERT INTO "TicketWatcher" ("tenantId","ticketId","userId","createdAt") VALUES (${user.tenantId},${id},${user.id},NOW()) ON CONFLICT DO NOTHING`;
    return { ok: true };
  }

  async unwatchTicket(user: AuthenticatedUser, id: string) {
    await this.prisma.$executeRaw`DELETE FROM "TicketWatcher" WHERE "ticketId" = ${id} AND "userId" = ${user.id}`;
    return { ok: true };
  }

  async listWatchers(user: AuthenticatedUser, id: string) {
    await this.requireTicket(user, id);
    return this.prisma.$queryRaw<Array<{ userId: string; createdAt: Date; fullName: string | null; email: string }>>`
      SELECT w."userId", w."createdAt", u."fullName", u."email"
      FROM "TicketWatcher" w
      JOIN "User" u ON u."id" = w."userId"
      WHERE w."ticketId" = ${id}
    `;
  }

  // 3.5 — Checklist
  async listChecklist(user: AuthenticatedUser, id: string) {
    await this.requireTicket(user, id);
    return this.prisma.$queryRaw<Array<{ id: string; title: string; done: boolean; position: number; doneAt: Date | null; doneById: string | null; createdAt: Date }>>`
      SELECT "id","title","done","position","doneAt","doneById","createdAt"
      FROM "TicketChecklistItem"
      WHERE "ticketId" = ${id} AND "tenantId" = ${user.tenantId}
      ORDER BY "position" ASC, "createdAt" ASC
    `;
  }

  async addChecklistItem(user: AuthenticatedUser, id: string, dto: { title: string; position?: number }) {
    await this.requireTicket(user, id);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "TicketChecklistItem" ("id","tenantId","ticketId","title","position","done","createdAt","updatedAt")
      VALUES (gen_random_uuid()::text, ${user.tenantId}, ${id}, ${dto.title}, ${dto.position ?? 0}, false, NOW(), NOW())
      RETURNING "id"
    `;
    return { id: rows[0]!.id, ticketId: id, title: dto.title, position: dto.position ?? 0, done: false };
  }

  async updateChecklistItem(user: AuthenticatedUser, ticketId: string, itemId: string, dto: { title?: string; position?: number }) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; title: string; position: number }>>`
      SELECT "id","title","position" FROM "TicketChecklistItem"
      WHERE "id" = ${itemId} AND "ticketId" = ${ticketId} AND "tenantId" = ${user.tenantId} LIMIT 1
    `;
    if (!rows.length) throw new NotFoundException('Kontrol listesi ogesi bulunamadi.');
    const item = rows[0]!;
    await this.prisma.$executeRaw`
      UPDATE "TicketChecklistItem"
      SET "title" = ${dto.title ?? item.title}, "position" = ${dto.position ?? item.position}, "updatedAt" = NOW()
      WHERE "id" = ${itemId}
    `;
    return { id: itemId, title: dto.title ?? item.title, position: dto.position ?? item.position };
  }

  async toggleChecklistItem(user: AuthenticatedUser, ticketId: string, itemId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; done: boolean }>>`
      SELECT "id","done" FROM "TicketChecklistItem"
      WHERE "id" = ${itemId} AND "ticketId" = ${ticketId} AND "tenantId" = ${user.tenantId} LIMIT 1
    `;
    if (!rows.length) throw new NotFoundException('Kontrol listesi ogesi bulunamadi.');
    const done = !rows[0]!.done;
    if (done) {
      await this.prisma.$executeRaw`UPDATE "TicketChecklistItem" SET "done"=true,"doneAt"=NOW(),"doneById"=${user.id},"updatedAt"=NOW() WHERE "id"=${itemId}`;
    } else {
      await this.prisma.$executeRaw`UPDATE "TicketChecklistItem" SET "done"=false,"doneAt"=NULL,"doneById"=NULL,"updatedAt"=NOW() WHERE "id"=${itemId}`;
    }
    return { id: itemId, done };
  }

  async removeChecklistItem(user: AuthenticatedUser, ticketId: string, itemId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "TicketChecklistItem"
      WHERE "id" = ${itemId} AND "ticketId" = ${ticketId} AND "tenantId" = ${user.tenantId} LIMIT 1
    `;
    if (!rows.length) throw new NotFoundException('Kontrol listesi ogesi bulunamadi.');
    await this.prisma.$executeRaw`DELETE FROM "TicketChecklistItem" WHERE "id" = ${itemId}`;
    return { ok: true };
  }

  async scheduleMessage(user: AuthenticatedUser, ticketId: string, dto: { body: string; scheduledAt?: string }) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
      include: { citizen: true },
    });
    if (!ticket) throw new NotFoundException('Ticket bulunamadı');

    const scheduledDate = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const delay = scheduledDate && scheduledDate.getTime() > Date.now()
      ? scheduledDate.getTime() - Date.now()
      : 0;

    // Create an outbound delivery record
    const delivery = await this.prisma.outboundDelivery.create({
      data: {
        tenantId: user.tenantId,
        conversationId: ticketId,
        channel: 'WHATSAPP',
        state: OutboundDeliveryState.PENDING,
        recipientPhone: ticket.citizen?.phone ?? null,
        body: dto.body,
      },
    });

    // Enqueue via notification queue with optional delay
    await this.notifications.enqueueScheduledDelivery(delivery.id, delay);

    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        ticketId,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        action: 'ticket.message_scheduled',
        after: { body: dto.body, scheduledAt: dto.scheduledAt ?? 'immediate', deliveryId: delivery.id },
      },
    });

    return { deliveryId: delivery.id, scheduledAt: dto.scheduledAt ?? null, delay };
  }
}
