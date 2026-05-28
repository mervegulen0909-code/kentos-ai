import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
  IsArray,
} from 'class-validator';
import { UserRole } from '@kentos/database';

export class CreateUserDto {
  @ApiProperty({ example: 'ali.yilmaz@belediye.gov.tr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ali Yılmaz' })
  @IsString()
  @IsNotEmpty({ message: 'fullName should not be empty' })
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OPERATOR })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ example: 'SecurePass123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['clx1...', 'clx2...'],
    description: 'Department IDs to assign the user to',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  departmentIds?: string[];
}
