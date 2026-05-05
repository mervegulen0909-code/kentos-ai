import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ChannelType } from '@kentos/database';
import type { IntakeChannel } from '@kentos/shared';

export class CreatePublicConversationDto {
  @IsOptional()
  @IsIn([ChannelType.WEB_CHAT, ChannelType.CITIZEN_WEB, ChannelType.MOBILE_APP])
  channel?: Exclude<IntakeChannel, 'WHATSAPP'>;

  @IsOptional()
  @IsString()
  externalConversationId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  initialMessage?: string;
}
