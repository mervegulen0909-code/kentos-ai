import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CreateWhatsappTemplateDto, WhatsappTemplatesService } from './whatsapp-templates.service.js';
import { CreateNotificationSinkDto, NotificationSinksService } from './notification-sinks.service.js';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@ApiTags('channels')
@Controller('channels')
export class ChannelsController {
  constructor(
    @Inject(WhatsappTemplatesService) private readonly waTpl: WhatsappTemplatesService,
    @Inject(NotificationSinksService) private readonly sinks: NotificationSinksService,
  ) {}

  // 5.3 — WhatsApp templates
  @ApiOperation({ summary: 'WhatsApp şablonlarını listele' })
  @Get('whatsapp-templates')
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.waTpl.list(user);
  }

  @ApiOperation({ summary: 'WhatsApp şablonu oluştur' })
  @Post('whatsapp-templates')
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWhatsappTemplateDto) {
    return this.waTpl.create(user, dto);
  }

  @ApiOperation({ summary: 'WhatsApp şablonu güncelle' })
  @Patch('whatsapp-templates/:id')
  updateTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: Partial<CreateWhatsappTemplateDto>) {
    return this.waTpl.update(user, id, dto);
  }

  @ApiOperation({ summary: 'WhatsApp şablonu sil' })
  @Delete('whatsapp-templates/:id')
  removeTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.waTpl.remove(user, id);
  }

  // 5.4 — Notification sinks (Slack / Teams)
  @ApiOperation({ summary: 'Bildirim sinklerini listele' })
  @Get('notification-sinks')
  listSinks(@CurrentUser() user: AuthenticatedUser) {
    return this.sinks.list(user);
  }

  @ApiOperation({ summary: 'Bildirim sink ekle (Slack / MS Teams)' })
  @Post('notification-sinks')
  createSink(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNotificationSinkDto) {
    return this.sinks.create(user, dto);
  }

  @ApiOperation({ summary: 'Bildirim sink güncelle' })
  @Patch('notification-sinks/:id')
  updateSink(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: Partial<CreateNotificationSinkDto> & { isActive?: boolean }) {
    return this.sinks.update(user, id, dto);
  }

  @ApiOperation({ summary: 'Bildirim sink devre dışı bırak' })
  @Delete('notification-sinks/:id')
  removeSink(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sinks.remove(user, id);
  }
}
