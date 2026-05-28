import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

@Injectable()
export class SocialMonitorService {
  private readonly logger = new Logger(SocialMonitorService.name);
  private get db(): any { return this.prisma; }

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listRules(user: AuthenticatedUser) {
    return this.db.socialMonitorRule.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRule(user: AuthenticatedUser, dto: { query: string; platform?: string }) {
    return this.db.socialMonitorRule.create({
      data: {
        tenantId: user.tenantId,
        platform: dto.platform ?? 'TWITTER',
        query: dto.query,
        isActive: true,
      },
    });
  }

  async updateRule(user: AuthenticatedUser, id: string, dto: { query?: string; isActive?: boolean }) {
    const rule = await this.db.socialMonitorRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!rule) throw new NotFoundException(`Rule not found: ${id}`);
    return this.db.socialMonitorRule.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  async deleteRule(user: AuthenticatedUser, id: string) {
    const rule = await this.db.socialMonitorRule.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!rule) throw new NotFoundException(`Rule not found: ${id}`);
    await this.db.socialMonitorRule.delete({ where: { id } });
    return { ok: true };
  }

  /** Poll Twitter API v2 for recent tweets matching active rules */
  async pollAll(): Promise<{ processed: number; errors: number }> {
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      this.logger.warn('TWITTER_BEARER_TOKEN not set — skipping social monitor poll');
      return { processed: 0, errors: 0 };
    }

    const rules = await this.db.socialMonitorRule.findMany({
      where: { isActive: true, platform: 'TWITTER' },
    });

    let processed = 0;
    let errors = 0;

    for (const rule of rules) {
      try {
        const tweets = await this.searchTweets(bearerToken, rule.query, rule.lastChecked);
        for (const tweet of tweets) {
          await this.ingestTweet(rule.tenantId, tweet, rule.query);
          processed++;
        }
        await this.db.socialMonitorRule.update({
          where: { id: rule.id },
          data: { lastChecked: new Date(), updatedAt: new Date() },
        });
      } catch (e) {
        this.logger.error(`Social monitor poll failed for rule ${rule.id}: ${e}`);
        errors++;
      }
    }

    return { processed, errors };
  }

  private async searchTweets(bearerToken: string, query: string, since?: Date): Promise<Tweet[]> {
    const params = new URLSearchParams({
      query: `${query} lang:tr -is:retweet`,
      max_results: '10',
      'tweet.fields': 'created_at,author_id',
    });

    if (since) {
      params.set('start_time', since.toISOString());
    }

    const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    if (res.status === 401) throw new Error('Twitter: unauthorized — check bearer token');
    if (res.status === 429) {
      this.logger.warn('Twitter rate limit hit');
      return [];
    }
    if (!res.ok) throw new Error(`Twitter API error: ${res.status}`);

    const data = await res.json() as { data?: Tweet[] };
    return data.data ?? [];
  }

  private async ingestTweet(tenantId: string, tweet: Tweet, query: string): Promise<void> {
    // Check if ticket already exists for this tweet
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Ticket" WHERE "tenantId" = ${tenantId} AND "ticketNo" LIKE ${'TW-' + tweet.id + '%'} LIMIT 1
    `;
    if (existing.length > 0) return;

    // Get the ticket number service pattern — just use raw insert for simplicity
    const tenantData = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenantData) return;

    const ticketNo = `TW-${tweet.id.slice(-8)}`;
    await this.prisma.$executeRaw`
      INSERT INTO "Ticket" (
        "id","tenantId","ticketNo","channel","status","priority",
        "title","description","createdAt","updatedAt"
      ) VALUES (
        gen_random_uuid()::text, ${tenantId}, ${ticketNo}, 'TWITTER'::"ChannelType", 'NEW'::"TicketStatus", 'NORMAL'::"TicketPriority",
        ${'Sosyal Medya: ' + tweet.text.slice(0, 80)},
        ${`Twitter'dan otomatik oluşturuldu (${query}):\n\n${tweet.text}`},
        NOW(), NOW()
      ) ON CONFLICT ("tenantId","ticketNo") DO NOTHING
    `;

    this.logger.log(`Social monitor: created ticket ${ticketNo} for tweet ${tweet.id}`);
  }
}
