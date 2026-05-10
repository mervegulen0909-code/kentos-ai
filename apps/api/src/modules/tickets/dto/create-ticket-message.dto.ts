import { ArrayMaxSize, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentIds?: string[];
}
