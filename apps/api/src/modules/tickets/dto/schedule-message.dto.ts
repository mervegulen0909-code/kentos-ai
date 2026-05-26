import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ScheduleMessageDto {
  @ApiProperty({ description: 'Mesaj içeriği' })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ description: 'Gönderim zamanı (ISO 8601) — boşsa hemen gönderilir' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
