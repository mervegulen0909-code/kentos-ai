import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AttachmentsModule } from './modules/attachments/attachments.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PublicTicketModule } from './modules/public/public-ticket.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { RootController } from './root.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    HealthModule,
    AnalyticsModule,
    AttachmentsModule,
    AuthModule,
    TenantsModule,
    TicketsModule,
    PublicTicketModule,
  ],
  controllers: [RootController],
})
export class AppModule {}
