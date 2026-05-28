import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerWithHeadersGuard } from './common/guards/throttler-with-headers.guard.js';
import { TenantThrottleGuard } from './common/guards/tenant-throttle.guard.js';
import { IpAllowlistGuard } from './common/guards/ip-allowlist.guard.js';
import { validateEnv } from './common/env.validation.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { CitizensModule } from './modules/citizens/citizens.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PublicTicketModule } from './modules/public/public-ticket.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CannedRepliesModule } from './modules/canned-replies/canned-replies.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { DigestModule } from './modules/digest/digest.module.js';
import { TicketTagsModule } from './modules/ticket-tags/ticket-tags.module.js';
import { PresenceModule } from './modules/presence/presence.module.js';
import { FaqArticlesModule } from './modules/faq/faq-articles.module.js';
import { AppointmentsModule } from './modules/appointments/appointments.module.js';
import { RootController } from './root.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        // Global varsayılan: dakikada 120 istek — admin panel ve normal API kullanımı için yeterli.
        // Auth endpoint'leri kendi @Throttle decorator'larıyla daha katı limitlere sahip.
        ttl: Number(config.get<string>('THROTTLE_TTL_MS') ?? 60_000),
        limit: Number(config.get<string>('THROTTLE_LIMIT') ?? 120),
      }]),
    }),
    PrismaModule,
    HealthModule,
    AnalyticsModule,
    AttachmentsModule,
    AuthModule,
    TenantsModule,
    TicketsModule,
    PublicTicketModule,
    UsersModule,
    ReportsModule,
    AdminModule,
    CitizensModule,
    EventsModule,
    CannedRepliesModule,
    ChannelsModule,
    DigestModule,
    TicketTagsModule,
    PresenceModule,
    FaqArticlesModule,
    AppointmentsModule,
  ],
  controllers: [RootController],
  providers: [
    // Global throttle: 120 req/min per IP — with X-RateLimit-* response headers
    { provide: APP_GUARD, useClass: ThrottlerWithHeadersGuard },
    // F8 — Tenant-based rate limit: 300 req/min per tenant (after auth)
    { provide: APP_GUARD, useClass: TenantThrottleGuard },
    // FAZ 1.9 — IP allowlist: tenant-level IP restriction for admin routes (no-op when list empty)
    { provide: APP_GUARD, useClass: IpAllowlistGuard },
  ],
})
export class AppModule {}
