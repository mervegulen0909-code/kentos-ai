import { IsEmail, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ChannelType } from '@kentos/database';
import type { IntakeChannel } from '@kentos/shared';

export class IngestChannelEnvelopeContactDto {
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((dto: IngestChannelEnvelopeContactDto) => Boolean(dto.email))
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  displayName?: string | null;
}

export class IngestChannelEnvelopeDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @IsIn([ChannelType.WHATSAPP, ChannelType.WEB_CHAT, ChannelType.CITIZEN_WEB, ChannelType.MOBILE_APP])
  channel!: IntakeChannel;

  @IsString()
  @MinLength(1)
  provider!: string;

  @IsOptional()
  @IsString()
  externalConversationId?: string;

  @IsOptional()
  @IsString()
  externalMessageId?: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsString()
  @MinLength(1)
  receivedAt!: string;

  @IsOptional()
  citizenContact?: IngestChannelEnvelopeContactDto;
}
