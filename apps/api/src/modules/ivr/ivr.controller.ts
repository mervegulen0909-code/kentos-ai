import { Body, Controller, Get, Header, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { IvrService } from './ivr.service.js';

@ApiTags('ivr')
@Controller('ivr')
export class IvrController {
  constructor(@Inject(IvrService) private readonly ivr: IvrService) {}

  // --- Twilio webhooks (no JWT auth — validated by Twilio signature) ---

  @ApiOperation({ summary: 'Twilio: çağrı geldi — TwiML karşılama döndür' })
  @Header('Content-Type', 'text/xml')
  @Post(':tenantSlug/voice')
  voice(@Param('tenantSlug') tenantSlug: string): string {
    return this.ivr.greeting(tenantSlug);
  }

  @ApiOperation({ summary: 'Twilio: kayıt tamamlandı' })
  @Header('Content-Type', 'text/xml')
  @Post(':tenantSlug/recording')
  async recording(
    @Param('tenantSlug') tenantSlug: string,
    @Body() payload: { CallSid: string; From: string; To: string; RecordingUrl?: string; RecordingSid?: string },
  ): Promise<string> {
    return this.ivr.handleRecording(tenantSlug, payload);
  }

  // --- Admin: çağrı yönetimi ---

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'IVR çağrılarını listele' })
  @Get('calls')
  listCalls(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.ivr.listCalls(user.tenantId, status);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Tek IVR çağrısı getir' })
  @Get('calls/:id')
  getCall(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ivr.getCall(user.tenantId, id);
  }
}
