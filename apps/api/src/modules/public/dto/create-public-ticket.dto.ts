import { IsEmail, IsIn, IsLatitude, IsLongitude, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { ChannelType } from '@kentos/database';
import type { IntakeChannel } from '@kentos/shared';

export class CreatePublicTicketDto {
  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsPhoneNumber('TR')
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsIn([ChannelType.CITIZEN_WEB, ChannelType.WEB_CHAT, ChannelType.MOBILE_APP])
  channel?: Exclude<IntakeChannel, 'WHATSAPP'>;
}
