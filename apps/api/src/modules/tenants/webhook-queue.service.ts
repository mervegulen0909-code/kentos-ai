import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { redisConnection } from '../../common/redis.js';
import { DEFAULT_JOB_OPTIONS } from '../../common/queue/queue-job-defaults.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type WebhookEventName =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'ticket.message_added'
  | 'sla.breached';

type WebhookJobData = {
  webhookId: string;
  event: WebhookEventName;
  payload: Record<string, unknown>;
  tenantId: string;
};

@Injectable()
export class WebhookQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookQueueService.name);
  private queue?: Queue<WebhookJobData>;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dispatchEvent(tenantId: string, event: WebhookEventName, payload: Record<string, unknown>): Promise<void> {
    try {
      // events is stored as Json (string[]) — fetch all active webhooks and
      // filter in-process because Prisma's `has` filter only works on scalar
      // list fields, not Json columns.
      const webhooks = await (this.prisma as unknown as {
        tenantWebhook: {
          findMany(args: unknown): Promise<{ id: string; events: unknown }[]>;
        };
      }).tenantWebhook.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, events: true },
      });

      const matching = webhooks.filter((wh) => {
        const evts = wh.events;
        return Array.isArray(evts) && (evts as string[]).includes(event);
      });

      await Promise.all(matching.map((wh) => this.dispatch({ webhookId: wh.id, event, payload, tenantId })));
    } catch (error) {
      // Never let webhook fan-out crash the request — log and continue.
      this.logger.warn(
        `dispatchEvent failed silently: ${error instanceof Error ? error.message : String(error)}`,
        { tenantId, event },
      );
    }
  }

  async dispatch(data: WebhookJobData): Promise<boolean> {
    try {
      await this.getQueue().add('webhook-delivery', data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `webhook-${data.webhookId}-${data.event}-${Date.now()}`,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Webhook dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        { webhookId: data.webhookId, event: data.event },
      );
      return false;
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }

  private getQueue() {
    this.queue ??= new Queue<WebhookJobData>('kentos.webhooks', {
      connection: redisConnection(),
    });
    return this.queue;
  }
}
