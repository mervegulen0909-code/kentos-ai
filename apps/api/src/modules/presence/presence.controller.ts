import { Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { PresenceService } from './presence.service.js';

@ApiBearerAuth()
@ApiTags('presence')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('presence')
export class PresenceController {
  constructor(@Inject(PresenceService) private readonly service: PresenceService) {}

  @ApiOperation({ summary: 'Operatör varlık bildirimi (her 30s çağrılmalı)' })
  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthenticatedUser) {
    return this.service.heartbeat(user);
  }

  @ApiOperation({ summary: 'Çevrimiçi operatörleri listele' })
  @Get()
  listOnline(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listOnline(user);
  }
}
