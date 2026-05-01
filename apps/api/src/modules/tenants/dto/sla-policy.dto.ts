import { TicketPriority } from '@kentos/database';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSlaPolicyDto {
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @IsInt()
  @Min(1)
  responseMinutes!: number;

  @IsInt()
  @Min(1)
  resolutionMinutes!: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class UpdateSlaPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  responseMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  resolutionMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
