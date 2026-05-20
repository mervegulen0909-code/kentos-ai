import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AuditActorType, ChannelType, OutboundDeliveryState } from '@kentos/database';
import type { IntakeChannel } from '@kentos/shared';
import { PrismaService } from '../prisma/prisma.service.js';

type DispatchInput = {
  tenantId: string;
  tenantSlug: string;
  channel: IntakeChannel;
  conversationId: string;
  externalConversationId: string | null;
  recipient: { phone?: string | null; email?: string | null };
  text: string;
  templateKey?: string;
  scheduledAt?: Date;
};

@Injectable()
export class OutboundDispatchService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboundDispatchService.name);
  private queue?: Queue<{ deliveryId: string }>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async onModuleDestroy() {
    await this.queue?.close().catch(() => {});
  }

  private getQueue() {
    this.queue ??= new Queue<{ deliveryId: string }>('kentos.outbound', {
      connection: { url: this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379' },
    });
    return this.queue;
  }

  async dispatch(input: DispatchInput) {
    const text = input.text?.trim();
    if (!text) return null;

    const phone = input.recipient.phone?.trim() || null;
    const email = input.recipient.email?.trim() || null;
    const requiresRecipient = input.channel !== 'WEB_CHAT' && input.channel !== 'CITIZEN_WEB' && input.channel !== 'MOBILE_APP';
    if (requiresRecipient && !phone && !email) {
      this.logger.warn(`Outbound atlandi: ${input.channel} icin alici bilgisi yok (conversation=${input.conversationId})`);
      return null;
    }

    const delivery = await this.prisma.outboundDelivery.create({
      data: {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        channel: input.channel as ChannelType,
        state: OutboundDeliveryState.PENDING,
        recipientPhone: phone,
        recipientEmail: email,
        externalConversationId: input.externalConversationId,
        templateKey: input.templateKey,
        body: text,
      },
    });

    if (input.channel === 'WEB_CHAT' || input.channel === 'CITIZEN_WEB' || input.channel === 'MOBILE_APP') {
      // In-process kanallarda gateway delivery yok; mesaj zaten konusma yanitiyla gosterildigi icin SKIPPED.
      await this.prisma.outboundDelivery.update({
        where: { id: delivery.id },
        data: { state: OutboundDeliveryState.SKIPPED, dispatchedAt: new Date() },
      });
      return delivery;
    }

    const scheduledDelay = input.scheduledAt && input.scheduledAt.getTime() > Date.now()
      ? input.scheduledAt.getTime() - Date.now()
      : undefined;

    try {
      await this.getQueue().add(
        'channel-outbound',
        { deliveryId: delivery.id },
        {
          jobId: `outbound-${delivery.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 200,
          removeOnFail: 1_000,
          delay: scheduledDelay,
        },
      );
      await this.recordAudit(input, delivery.id, 'channel.outbound_enqueued');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'queue-enqueue-failed';
      this.logger.warn(`Outbound queue enqueue basarisiz (kanal=${input.channel}): ${message}; delivery PENDING birakildi.`);
      await this.prisma.outboundDelivery.update({
        where: { id: delivery.id },
        data: {
          state: OutboundDeliveryState.PENDING,
          lastError: message.slice(0, 200),
        },
      });
      await this.recordAudit(input, delivery.id, 'channel.outbound_enqueue_failed', message);
    }
    return delivery;
  }

  private async recordAudit(input: DispatchInput, deliveryId: string, action: string, error?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorType: AuditActorType.SYSTEM,
          action,
          after: {
            deliveryId,
            channel: input.channel,
            conversationId: input.conversationId,
            templateKey: input.templateKey ?? null,
            error: error ?? null,
          },
        },
      });
    } catch (cause) {
      this.logger.warn(`AuditLog yazilamadi (${action}): ${cause instanceof Error ? cause.message : ''}`);
    }
  }
}
