import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export const MESSAGE_TEMPLATE_CHANNELS = [
  'WHATSAPP',
  'WEB_CHAT',
  'CITIZEN_WEB',
  'MOBILE_APP',
  'OPERATOR',
  'INSTAGRAM',
  'FACEBOOK',
  'SMS',
] as const;

export type MessageTemplateChannel = (typeof MESSAGE_TEMPLATE_CHANNELS)[number];

export class UpdateMessageTemplateDto {
  @IsString()
  @MinLength(5)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(MESSAGE_TEMPLATE_CHANNELS)
  channel?: MessageTemplateChannel | null;
}
