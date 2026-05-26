import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class BulkAssignDto {
  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @ArrayUnique()
  ticketIds!: string[];

  @ApiProperty({ description: 'User ID to assign tickets to' })
  @IsString()
  assignedToId!: string;
}
