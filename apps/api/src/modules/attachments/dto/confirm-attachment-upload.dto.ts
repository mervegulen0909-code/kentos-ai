import { IsString, Matches } from 'class-validator';

export class ConfirmAttachmentUploadDto {
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  checksumSha256!: string;
}
