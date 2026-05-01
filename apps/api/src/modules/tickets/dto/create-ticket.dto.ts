import { ChannelType, TicketPriority } from '@kentos/database';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  citizenId?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
