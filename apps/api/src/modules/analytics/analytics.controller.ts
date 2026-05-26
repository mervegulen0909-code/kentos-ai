import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AnalyticsService } from './analytics.service.js';

@ApiBearerAuth()
@ApiTags('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @ApiOperation({ summary: 'Özet dashboard metrikleri (açık ticket, SLA, bugünkü çözüm)' })
  @ApiResponse({ status: 200, description: 'Genel bakış istatistikleri' })
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.overview(user);
  }

  @ApiOperation({ summary: 'Departman bazlı ticket dağılımı' })
  @Get('departments')
  departments(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.departments(user);
  }

  @ApiOperation({ summary: 'Kategori bazlı ticket dağılımı' })
  @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.categories(user);
  }

  @ApiOperation({ summary: 'Mahalle bazlı ticket dağılımı' })
  @Get('neighborhoods')
  neighborhoods(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.neighborhoods(user);
  }

  @ApiOperation({ summary: 'Kanal bazlı gelen mesaj dağılımı' })
  @Get('channels')
  channels(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.channels(user);
  }

  @ApiOperation({ summary: 'Konuşma segmentleri analizi' })
  @Get('conversation-segments')
  conversationSegments(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.conversationSegments(user);
  }

  @ApiOperation({ summary: 'AI kullanım istatistikleri (token, maliyet)' })
  @Get('ai-usage')
  aiUsage(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.aiUsage(user);
  }

  @ApiOperation({ summary: 'Outbound delivery istatistikleri (kanal ve durum bazlı)' })
  @Get('outbound-deliveries')
  outboundDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.outboundDeliveries(user);
  }

  @ApiOperation({ summary: 'CSAT memnuniyet skoru (genel, departman bazlı, trend)' })
  @Get('csat')
  csat(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.csat(user);
  }

  @ApiOperation({ summary: 'Operatör performans metrikleri (son 30 gün)' })
  @Get('operators')
  operatorPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.operatorPerformance(user);
  }
}
