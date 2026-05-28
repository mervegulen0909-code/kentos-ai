import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AnalyticsService } from './analytics.service.js';

function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

@ApiBearerAuth()
@ApiTags('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @ApiOperation({ summary: 'Özet dashboard metrikleri (açık ticket, SLA, bugünkü çözüm)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 başlangıç tarihi' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 bitiş tarihi' })
  @ApiResponse({ status: 200, description: 'Genel bakış istatistikleri' })
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.overview(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'Departman bazlı ticket dağılımı' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('departments')
  departments(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.departments(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'Kategori bazlı ticket dağılımı' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.categories(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'Mahalle bazlı ticket dağılımı' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('neighborhoods')
  neighborhoods(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.neighborhoods(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'Kanal bazlı gelen mesaj dağılımı' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('channels')
  channels(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.channels(user, parseDateParam(from), parseDateParam(to));
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
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('outbound-deliveries')
  outboundDeliveries(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.outboundDeliveries(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'CSAT memnuniyet skoru (genel, departman bazlı, trend)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('csat')
  csat(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.csat(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'Operatör performans metrikleri' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get('operators')
  operatorPerformance(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.operatorPerformance(user, parseDateParam(from), parseDateParam(to));
  }

  @ApiOperation({ summary: 'SLA ihlal trendi (günlük ihlal / çözüm sayıları)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 başlangıç tarihi (varsayılan: 30 gün önce)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 bitiş tarihi (varsayılan: bugün)' })
  @Get('sla-trend')
  slaTrend(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.slaTrend(user, parseDateParam(from), parseDateParam(to));
  }
}
