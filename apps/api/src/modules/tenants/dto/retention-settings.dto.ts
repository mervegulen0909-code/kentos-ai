import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_RETENTION_DAYS, MIN_RETENTION_DAYS } from '@kentos/shared';

export class UpdateRetentionSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(MIN_RETENTION_DAYS)
  @Max(MAX_RETENTION_DAYS)
  'channel-events'?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_RETENTION_DAYS)
  @Max(MAX_RETENTION_DAYS)
  'audit-logs'?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_RETENTION_DAYS)
  @Max(MAX_RETENTION_DAYS)
  'outbound-deliveries'?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_RETENTION_DAYS)
  @Max(MAX_RETENTION_DAYS)
  conversations?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_RETENTION_DAYS)
  @Max(MAX_RETENTION_DAYS)
  attachments?: number;
}
