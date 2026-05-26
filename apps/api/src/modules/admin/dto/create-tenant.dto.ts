import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'İstanbul Büyükşehir Belediyesi' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'istanbul-bs' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug yalnızca küçük harf, rakam ve tire içerebilir' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Europe/Istanbul', default: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'tr-TR', default: 'tr-TR' })
  @IsOptional()
  @IsString()
  locale?: string;
}
