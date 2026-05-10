import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AttachmentsService } from './attachments.service.js';
import { ConfirmAttachmentUploadDto } from './dto/confirm-attachment-upload.dto.js';
import { InitiateAttachmentUploadDto } from './dto/initiate-attachment-upload.dto.js';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(@Inject(AttachmentsService) private readonly attachments: AttachmentsService) {}

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post('uploads')
  initiate(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitiateAttachmentUploadDto) {
    return this.attachments.initiateAdminUpload(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ConfirmAttachmentUploadDto) {
    return this.attachments.confirmAdminUpload(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @Get('quarantined')
  quarantined(@CurrentUser() user: AuthenticatedUser) {
    return this.attachments.listQuarantined(user);
  }

  @Get(':id/download')
  download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.attachments.createAdminDownload(user, id);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Post(':id/rescan')
  rescan(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.attachments.rescanAttachment(user, id);
  }
}
