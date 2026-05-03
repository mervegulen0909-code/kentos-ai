import { ChannelType } from '@kentos/database';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type TemplateContext = {
  departmentName?: string | null;
  question?: string | null;
};

@Injectable()
export class NotificationTemplateService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async renderForTicket(ticketId: string, key: string, context: TemplateContext = {}) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId },
      select: {
        id: true,
        tenantId: true,
        ticketNo: true,
        publicTrackingToken: true,
        channel: true,
        citizenId: true,
        department: { select: { name: true } },
      },
    });

    if (!ticket || !this.hasCitizenFacingChannel(ticket.channel, ticket.publicTrackingToken, ticket.citizenId)) {
      return null;
    }

    const channelTemplate = await this.prisma.messageTemplate.findFirst({
      where: {
        tenantId: ticket.tenantId,
        key,
        isActive: true,
        channel: ticket.channel,
      },
      orderBy: { updatedAt: 'desc' },
      select: { body: true },
    });
    const template = channelTemplate ?? await this.prisma.messageTemplate.findFirst({
      where: {
        tenantId: ticket.tenantId,
        key,
        isActive: true,
        channel: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: { body: true },
    });

    if (!template) return null;

    return template.body.replace(/{{\s*(\w+)\s*}}/g, (_, placeholder: string) => {
      const values: Record<string, string> = {
        trackingToken: ticket.publicTrackingToken ?? ticket.ticketNo,
        ticketNo: ticket.ticketNo,
        departmentName: context.departmentName ?? ticket.department?.name ?? '',
        question: context.question ?? '',
      };

      return values[placeholder] ?? '';
    });
  }

  private hasCitizenFacingChannel(channel: ChannelType, publicTrackingToken: string | null, citizenId: string | null) {
    return channel === ChannelType.CITIZEN_WEB || Boolean(publicTrackingToken) || Boolean(citizenId);
  }
}
