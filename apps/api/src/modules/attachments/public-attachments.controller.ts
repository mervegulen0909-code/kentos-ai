import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { AttachmentsService } from './attachments.service.js';
import { ConfirmAttachmentUploadDto } from './dto/confirm-attachment-upload.dto.js';
import { InitiatePublicAttachmentUploadDto } from './dto/initiate-public-attachment-upload.dto.js';

@UseGuards(PublicChannelGuard)
@Controller('public/:tenantSlug/attachments')
export class PublicAttachmentsController {
  constructor(@Inject(AttachmentsService) private readonly attachments: AttachmentsService) {}

  @Post('uploads')
  initiate(@Param('tenantSlug') tenantSlug: string, @Body() dto: InitiatePublicAttachmentUploadDto) {
    return this.attachments.initiatePublicUpload(tenantSlug, dto);
  }

  @Post(':id/confirm')
  confirm(@Param('tenantSlug') tenantSlug: string, @Param('id') id: string, @Body() dto: ConfirmAttachmentUploadDto) {
    return this.attachments.confirmPublicUpload(tenantSlug, id, dto);
  }

  @Get(':id/download')
  download(@Param('tenantSlug') tenantSlug: string, @Param('id') id: string, @Query('trackingToken') trackingToken = '') {
    return this.attachments.createPublicDownload(tenantSlug, id, trackingToken);
  }
}
