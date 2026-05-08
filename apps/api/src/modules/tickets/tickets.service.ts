import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility, TicketStatus, UserRole } from '@kentos/database';
import type { Prisma } from '@kentos/database';
import type { IntakeClassification } from '@kentos/shared';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationQueueService } from './notification-queue.service.js';
import { NotificationTemplateService } from './notification-template.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { SlaService } from './sla.service.js';
import { TicketNumberService } from './ticket-number.service.js';

@Injectable()
export class TicketsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationQueueService) private readonly notifications: NotificationQueueService,
    @Inject(NotificationTemplateService) private readonly templates: NotificationTemplateService,
    @Inject(SlaService) private readonly sla: SlaService,
    @Inject(TicketNumberService) private readonly ticketNumbers: TicketNumberService,
  ) {}

  async list(
    user: AuthenticatedUser,
    filters: {
      status?: TicketStatus;
      departmentId?: string;
      categoryId?: string;
      assignedToId?: string;
      q?: string;
    } = {},
  ) {
    const departmentScope = await this.departmentScope(user);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenantId: user.tenantId,
        status: filters.status,
        departmentId: this.scopedDepartmentFilter(departmentScope, filters.departmentId),
        categoryId: filters.categoryId,
        assignedToId: filters.assignedToId,
        OR: filters.q
          ? [
              { ticketNo: { contains: filters.q, mode: 'insensitive' } },
              { publicTrackingToken: { contains: filters.q, mode: 'insensitive' } },
              { title: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
              { addressText: { contains: filters.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { department: true, category: true, assignedTo: true, citizen: true },
      orderBy: [{ createdAt: 'desc' }, { resolutionDueAt: 'asc' }],
      take: 100,
    });

    return tickets.map((ticket) => ({ ...ticket, slaState: this.slaState(ticket.resolutionDueAt) }));
  }

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    const relations = await this.validateTicketRelations(user.tenantId, dto);
    await this.requireDepartmentScope(user, relations.departmentId);

    const priority = dto.priority ?? 'NORMAL';
    const deadlines = await this.sla.calculateDeadlines({
      tenantId: user.tenantId,
      priority,
      departmentId: relations.departmentId,
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
        departmentId: relations.departmentId,
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
            after: { ...dto },
          },
        },
      },
      include: { auditLogs: true },
    });

    return ticket;
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
        messages: { orderBy: { createdAt: 'asc' } },
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
        classification: (ticket.aiClassification as IntakeClassification | null) ?? null,
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
    const routedMessage = await this.templates.renderForTicket(ticket.id, 'TICKET_ROUTED', { departmentName: department.name });

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
    return updatedTicket;
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
    await this.notifications.enqueueMessage(message.id);
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
        handoffRequested: true,
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

    if (typeof existingTicket?.trackingToken === 'string') {
      throw new ForbiddenException('Bu konusma icin zaten ticket olusturulmus.');
    }

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
      WAITING_INFO: [TicketStatus.TRIAGED, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.REJECTED],
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
}
