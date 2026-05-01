import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { PublicTicketModule } from './modules/public/public-ticket.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AnalyticsModule,
    AuthModule,
    TenantsModule,
    TicketsModule,
    PublicTicketModule,
  ],
})
export class AppModule {}
