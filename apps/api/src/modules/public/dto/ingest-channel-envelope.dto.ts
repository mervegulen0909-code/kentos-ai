import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
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

export class IngestChannelEnvelopeMediaDto {
  @IsOptional()
  @IsString()
  providerMediaId?: string;

  @IsString()
  @MinLength(1)
  mimeType!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sizeBytes?: number;

  @IsOptional()
  @IsUrl()
  url?: string;
}

export class IngestChannelEnvelopeDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @IsIn([
    ChannelType.WHATSAPP,
    ChannelType.WEB_CHAT,
    ChannelType.CITIZEN_WEB,
    ChannelType.MOBILE_APP,
    ChannelType.INSTAGRAM,
    ChannelType.FACEBOOK,
    ChannelType.SMS,
    ChannelType.EMAIL,
  ])
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
  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IngestChannelEnvelopeContactDto)
  citizenContact?: IngestChannelEnvelopeContactDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => IngestChannelEnvelopeMediaDto)
  media?: IngestChannelEnvelopeMediaDto[];
}
