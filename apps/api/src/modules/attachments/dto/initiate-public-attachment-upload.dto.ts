import { IsOptional, IsString } from 'class-validator';
import { InitiateAttachmentUploadDto } from './initiate-attachment-upload.dto.js';

export class InitiatePublicAttachmentUploadDto extends InitiateAttachmentUploadDto {
  @IsOptional()
  @IsString()
  trackingToken?: string;

  @IsOptional()
  @IsString()
  contact?: string;
}
