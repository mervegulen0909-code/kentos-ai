import { IsEmail, IsOptional, IsPhoneNumber, IsString, MinLength, ValidateIf } from 'class-validator';

export class SendPublicConversationMessageDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @ValidateIf((dto: SendPublicConversationMessageDto) => Boolean(dto.phone))
  @IsPhoneNumber('TR')
  phone?: string;

  @ValidateIf((dto: SendPublicConversationMessageDto) => Boolean(dto.email))
  @IsEmail()
  email?: string;
}
