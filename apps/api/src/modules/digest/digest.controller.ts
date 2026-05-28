import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { DigestService } from './digest.service.js';

class DigestTriggerDto {
  @IsOptional()
  @IsEmail()
  targetEmail?: string;
}

@ApiBearerAuth()
@ApiTags('digest')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('digest')
export class DigestController {
  constructor(@Inject(DigestService) private readonly service: DigestService) {}

  @ApiOperation({ summary: 'Haftalık AI digest e-postasını şimdi gönder (test / manuel tetik)' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @Post('trigger')
  trigger(@CurrentUser() user: AuthenticatedUser, @Body() dto: DigestTriggerDto) {
    return this.service.triggerDigest(user, dto.targetEmail);
  }

  @ApiOperation({ summary: 'Haftalık digest zamanlamasını kur (BullMQ repeatable job)' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Post('schedule')
  schedule(@CurrentUser() user: AuthenticatedUser, @Body() dto: DigestTriggerDto) {
    return this.service.scheduleWeeklyDigest(user, dto.targetEmail);
  }
}
