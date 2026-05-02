import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, MessageVisibility, TicketStatus, UserRole } from '@kentos/database';
import type { Prisma } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
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
              { title: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
              { addressText: { contains: filters.q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { department: true, category: true, assignedTo: true, citizen: true },
      orderBy: [{ resolutionDueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return tickets.map((ticket) => ({ ...ticket, slaState: this.slaState(ticket.resolutionDueAt) }));
  }

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    await this.requireDepartmentScope(user, dto.departmentId);
    const priority = dto.priority ?? 'NORMAL';
    const deadlines = await this.sla.calculateDeadlines({
      tenantId: user.tenantId,
      priority,
      departmentId: dto.departmentId,
      categoryId: dto.categoryId,
    });

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId: user.tenantId,
        ticketNo: await this.ticketNumbers.nextTicketNo(user.tenantId),
        channel: dto.channel,
        title: dto.title,
        description: dto.description,
        priority,
        categoryId: dto.categoryId,
        departmentId: dto.departmentId,
        citizenId: dto.citizenId,
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

    if (!ticket) throw new NotFoundException('Talep bulunamadı.');
    return ticket;
  }

  async assign(user: AuthenticatedUser, id: string, dto: AssignTicketDto) {
    const ticket = await this.requireTicket(user, id);
    this.requireMutableTicket(ticket.status);
    await this.requireDepartment(user.tenantId, dto.departmentId);
    await this.requireDepartmentScope(user, dto.departmentId);
    if (dto.assignedToId) await this.requireAssignableUser(user.tenantId, dto.assignedToId, dto.departmentId);

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: ticket.status === TicketStatus.NEW || ticket.status === TicketStatus.TRIAGED ? TicketStatus.ASSIGNED : ticket.status,
        departmentId: dto.departmentId,
        assignedToId: dto.assignedToId,
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
    });
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
    return message;
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.requireTicket(user, id);
    if (!this.canTransition(ticket.status, dto.status)) {
      throw new ForbiddenException(`${ticket.status} durumundan ${dto.status} durumuna geçiş desteklenmiyor.`);
    }

    const now = new Date();
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        firstRespondedAt: ticket.firstRespondedAt ?? (dto.status !== TicketStatus.NEW ? now : null),
        resolvedAt: dto.status === TicketStatus.RESOLVED ? now : ticket.resolvedAt,
        closedAt: dto.status === TicketStatus.CLOSED ? now : ticket.closedAt,
        messages: dto.publicMessage
          ? {
              create: {
                tenantId: user.tenantId,
                senderType: AuditActorType.USER,
                senderId: user.id,
                visibility: MessageVisibility.PUBLIC,
                body: dto.publicMessage,
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
    });

    return updated;
  }

  async auditLog(user: AuthenticatedUser, id: string) {
    await this.requireTicket(user, id);
    return this.prisma.auditLog.findMany({ where: { tenantId: user.tenantId, ticketId: id }, orderBy: { createdAt: 'desc' } });
  }

  private async requireTicket(user: AuthenticatedUser, id: string) {
    const departmentScope = await this.departmentScope(user);
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId: user.tenantId, departmentId: this.scopedDepartmentFilter(departmentScope) },
    });
    if (!ticket) throw new NotFoundException('Talep bulunamadı.');
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
    if (!departmentId || !departmentScope.includes(departmentId)) throw new ForbiddenException('Bu birim için işlem yetkiniz yok.');
  }

  private async requireDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId, isActive: true } });
    if (!department) throw new NotFoundException('Birim bulunamadı.');
    return department;
  }

  private async requireAssignableUser(tenantId: string, userId: string, departmentId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      include: { departments: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.role === UserRole.DEPARTMENT_STAFF && !user.departments.some((department) => department.departmentId === departmentId)) {
      throw new ForbiddenException('Kullanıcı bu birime atanamaz.');
    }
    return user;
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
      throw new ForbiddenException(`${status} durumundaki talep değiştirilemez.`);
    }
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
}
