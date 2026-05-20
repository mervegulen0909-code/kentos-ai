import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ enum: ['ios', 'android'], example: 'android' })
  @IsIn(['ios', 'android'])
  platform!: string;

  @ApiProperty({ description: 'FCM/APNs device token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'Citizen identifier (phone or email)' })
  @IsString()
  @IsNotEmpty()
  citizenIdentifier!: string;
}
