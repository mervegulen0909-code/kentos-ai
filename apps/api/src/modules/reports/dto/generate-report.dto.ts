import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GenerateReportDto {
  @ApiPropertyOptional({
    description: 'Rapor tipi',
    example: 'weekly_summary',
    default: 'weekly_summary',
  })
  @IsOptional()
  @IsString()
  type?: string = 'weekly_summary';
}
