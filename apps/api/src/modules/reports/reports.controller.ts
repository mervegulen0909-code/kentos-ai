import {
  Body,
  Controller,
  Get,
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
