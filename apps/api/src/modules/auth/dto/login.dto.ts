import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  tenantSlug!: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
