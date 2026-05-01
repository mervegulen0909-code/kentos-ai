import { IsEmail, IsLatitude, IsLongitude, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class CreatePublicTicketDto {
  @IsString()
  @MinLength(10)
  description!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsPhoneNumber('TR')
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
