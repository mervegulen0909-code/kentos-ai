import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  widgetEnabled?: boolean;

  @IsOptional()
  @IsString()
  widgetTitle?: string;

  @IsOptional()
  @IsString()
  widgetWelcome?: string;
}
