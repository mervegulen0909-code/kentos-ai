import { ArrayMaxSize, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePublicMessageDto {
  @IsString()
  @MinLength(2)
  body!: string;

  @IsString()
  contact!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentIds?: string[];
}
