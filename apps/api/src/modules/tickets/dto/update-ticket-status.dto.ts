import { TicketStatus } from '@kentos/database';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsOptional()
  @IsString()
  publicMessage?: string;
}
