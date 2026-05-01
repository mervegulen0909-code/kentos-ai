import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMessageTemplateDto {
  @IsString()
  @MinLength(5)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
