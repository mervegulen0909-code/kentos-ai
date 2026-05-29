import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { GenerateReportDto } from './dto/generate-report.dto.js';
import { ReportsService } from './reports.service.js';

@ApiBearerAuth()
@ApiTags('reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @ApiOperation({ summary: 'Rapor oluşturma talebini kuyruğa ekle' })
  @ApiResponse({ status: 201, description: 'Rapor kuyruğa eklendi' })
  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reports.generate(user, dto);
  }

  @ApiOperation({ summary: 'Raporları listele (sayfalı)' })
  @ApiQuery({ name: 'type', required: false, description: 'Rapor tipi filtresi' })
  @ApiQuery({ name: 'page', required: false, description: 'Sayfa numarası', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Sayfa başına kayıt', type: Number })
  @ApiResponse({ status: 200, description: 'Rapor listesi' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.list(user, {
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // 6.2 — Rapor abonelikleri
  @ApiOperation({ summary: 'Rapor aboneliklerini listele' })
  @Get('subscriptions')
  listSubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.listSubscriptions(user);
  }

  @ApiOperation({ summary: 'Yeni rapor aboneliği oluştur' })
  @Post('subscriptions')
  createSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { reportType: string; frequency?: string; email?: string },
  ) {
    return this.reports.createSubscription(user, dto);
  }

  @ApiOperation({ summary: 'Rapor aboneliğini iptal et' })
  @Delete('subscriptions/:id')
  removeSubscription(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reports.removeSubscription(user, id);
  }

  // 6.1 — CSV export
  @ApiOperation({ summary: 'Ticket listesini CSV olarak indir (maks 10.000 kayıt)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 başlangıç tarihi' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 bitiş tarihi' })
  @Header('Cache-Control', 'no-store')
  @Get('export/csv')
  exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parseDate = (v?: string) => (v ? (isNaN(new Date(v).getTime()) ? undefined : new Date(v)) : undefined);
    return this.reports.exportCsv(user, { from: parseDate(from), to: parseDate(to) });
  }

  // NOTE: ':id' route MUST be declared last so static paths
  // (subscriptions, export/csv) are matched before the param route.
  @ApiOperation({ summary: 'Tek raporu getir' })
  @ApiResponse({ status: 200, description: 'Rapor detayı' })
  @ApiResponse({ status: 404, description: 'Rapor bulunamadı' })
  @Get(':id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.reports.get(user, id);
  }
}
