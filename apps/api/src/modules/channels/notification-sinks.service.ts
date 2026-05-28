import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

export class CreateNotificationSinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(['SLACK', 'TEAMS'])
  type!: string;

  @IsUrl()
  webhookUrl!: string;

  @IsOptional()
  @IsArray()
  events?: string[];
}

@Injectable()
export class NotificationSinksService {
  private readonly logger = new Logger(NotificationSinksService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return this.prisma; }

  list(user: AuthenticatedUser) {
    return this.db.notificationSink.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  create(user: AuthenticatedUser, dto: CreateNotificationSinkDto) {
    return this.db.notificationSink.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        type: dto.type,
        webhookUrl: dto.webhookUrl,
        events: dto.events ?? ['ticket.created', 'ticket.resolved'],
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: Partial<CreateNotificationSinkDto> & { isActive?: boolean }) {
    const sink = await this.db.notificationSink.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!sink) throw new NotFoundException('Bildirim sink bulunamadı.');
    return this.db.notificationSink.update({
      where: { id },
      data: {
        name: dto.name ?? sink.name,
        webhookUrl: dto.webhookUrl ?? sink.webhookUrl,
        events: dto.events ?? sink.events,
        isActive: dto.isActive ?? sink.isActive,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const sink = await this.db.notificationSink.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!sink) throw new NotFoundException('Bildirim sink bulunamadı.');
    await this.db.notificationSink.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  async dispatch(tenantId: string, event: string, payload: Record<string, unknown>) {
    const sinks = await this.db.notificationSink.findMany({
      where: { tenantId, isActive: true },
    });

    const eligible = (sinks as Array<{ type: string; webhookUrl: string; events: unknown }>)
      .filter((s) => Array.isArray(s.events) && (s.events as string[]).includes(event));

    await Promise.allSettled(
      eligible.map(async (sink) => {
        try {
          const body = sink.type === 'SLACK'
            ? JSON.stringify({ text: `*${event}*\n${JSON.stringify(payload, null, 2)}` })
            : JSON.stringify({
                '@type': 'MessageCard',
                '@context': 'http://schema.org/extensions',
                summary: event,
                text: `**${event}**\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\``,
              });
          const res = await fetch(sink.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: AbortSignal.timeout(5_000),
          });
          if (!res.ok) this.logger.warn(`Sink dispatch failed (${res.status}): ${sink.webhookUrl}`);
        } catch (err) {
          this.logger.warn(`Sink dispatch error: ${String(err)}`);
        }
      }),
    );
  }
}
