import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AdminService } from './admin.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Tüm kiracıları listele' })
  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @ApiOperation({ summary: 'Kiracı detayı' })
  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @ApiOperation({ summary: 'Yeni kiracı oluştur' })
  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @ApiOperation({ summary: 'Kiracı güncelle' })
  @Patch('tenants/:id')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.adminService.updateTenant(id, dto);
  }

  @ApiOperation({ summary: 'Kiracı için varsayılan veri ekle' })
  @Post('tenants/:id/seed')
  seedTenant(@Param('id') id: string) {
    return this.adminService.seedTenant(id);
  }
}
