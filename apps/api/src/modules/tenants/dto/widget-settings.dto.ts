import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateWidgetSettingsDto {
  @IsOptional()
  @IsBoolean()
  widgetEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  widgetTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  widgetWelcome?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value.map((origin) => String(origin).trim()).filter(Boolean) : value)
  widgetAllowedOrigins?: string[];
}
