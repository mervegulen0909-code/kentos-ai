import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, ChannelType, MessageVisibility } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlaService } from '../tickets/sla.service.js';
import { TicketNumberService } from '../tickets/ticket-number.service.js';
import { CreatePublicMessageDto } from './dto/create-public-message.dto.js';
import { CreatePublicTicketDto } from './dto/create-public-ticket.dto.js';

@Injectable()
export class PublicTicketService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SlaService) private readonly sla: SlaService,
    @Inject(TicketNumberService) private readonly ticketNumbers: TicketNumberService,
  ) {}

  async create(tenantSlug: string, dto: CreatePublicTicketDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadı.');

    const existingCitizen = dto.phone || dto.email
      ? await this.prisma.citizen.findFirst({
          where: {
            tenantId: tenant.id,
            OR: [dto.phone ? { phone: dto.phone } : {}, dto.email ? { email: dto.email } : {}],
          },
        })
      : null;

    const citizen = existingCitizen
      ? await this.prisma.citizen.update({
          where: { id: existingCitizen.id },
          data: {
            displayName: dto.displayName ?? existingCitizen.displayName,
            phone: dto.phone ?? existingCitizen.phone,
            email: dto.email ?? existingCitizen.email,
          },
        })
      : dto.phone || dto.email
        ? await this.prisma.citizen.create({
            data: {
              tenantId: tenant.id,
              displayName: dto.displayName,
              phone: dto.phone,
              email: dto.email,
            },
          })
        : null;

    const deadlines = await this.sla.calculateDeadlines({ tenantId: tenant.id, priority: 'NORMAL' });

    const ticket = await this.prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        ticketNo: await this.ticketNumbers.nextTicketNo(tenant.id),
        citizenId: citizen?.id,
        channel: ChannelType.CITIZEN_WEB,
        title: dto.title ?? dto.description.slice(0, 80),
        description: dto.description,
        addressText: dto.addressText,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ...deadlines,
        auditLogs: {
          create: {
            tenantId: tenant.id,
            actorType: AuditActorType.CITIZEN,
            action: 'ticket.public_created',
            after: { channel: ChannelType.CITIZEN_WEB },
          },
        },
      },
      include: { department: true, category: true },
    });

    return this.toPublicTicket(ticket);
  }

  async get(tenantSlug: string, ticketNo: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenant: { slug: tenantSlug }, ticketNo },
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

    if (!ticket) throw new NotFoundException('Başvuru bulunamadı.');
    return this.toPublicTicket(ticket);
  }

  async addMessage(tenantSlug: string, ticketNo: string, dto: CreatePublicMessageDto) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenant: { slug: tenantSlug }, ticketNo },
      include: { citizen: true },
    });

    if (!ticket) throw new NotFoundException('Başvuru bulunamadı.');
    if (ticket.citizen?.phone !== dto.contact && ticket.citizen?.email !== dto.contact) {
      throw new ForbiddenException('Başvuruya mesaj eklemek için kayıtlı iletişim bilgisini girin.');
    }

    await this.prisma.ticketMessage.create({
      data: {
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        senderType: AuditActorType.CITIZEN,
        visibility: MessageVisibility.PUBLIC,
        body: dto.body,
        channel: ChannelType.CITIZEN_WEB,
      },
    });

    return this.get(tenantSlug, ticketNo);
  }

  private toPublicTicket(ticket: {
    ticketNo: string;
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
      ticketNo: ticket.ticketNo,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      addressText: ticket.addressText,
      departmentName: ticket.department?.name ?? null,
      categoryName: ticket.category?.name ?? null,
      resolutionDueAt: ticket.resolutionDueAt,
      createdAt: ticket.createdAt,
      publicMessages: ticket.messages ?? [],
    };
  }
}
