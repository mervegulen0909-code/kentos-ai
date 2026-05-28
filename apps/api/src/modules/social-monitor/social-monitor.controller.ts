import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { SocialMonitorService } from './social-monitor.service.js';

@ApiBearerAuth()
@ApiTags('social-monitor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('social-monitor')
export class SocialMonitorController {
  constructor(@Inject(SocialMonitorService) private readonly svc: SocialMonitorService) {}

  @ApiOperation({ summary: 'İzleme kurallarını listele' })
  @Get('rules')
  listRules(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.listRules(user);
  }

  @ApiOperation({ summary: 'Yeni izleme kuralı ekle' })
  @Post('rules')
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { query: string; platform?: string },
  ) {
    return this.svc.createRule(user, dto);
  }

  @ApiOperation({ summary: 'İzleme kuralını güncelle' })
  @Patch('rules/:id')
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { query?: string; isActive?: boolean },
  ) {
    return this.svc.updateRule(user, id, dto);
  }

  @ApiOperation({ summary: 'İzleme kuralını sil' })
  @Delete('rules/:id')
  deleteRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteRule(user, id);
  }

  @ApiOperation({ summary: 'Sosyal medyayı manuel olarak tara' })
  @Post('poll')
  poll() {
    return this.svc.pollAll();
  }
}
