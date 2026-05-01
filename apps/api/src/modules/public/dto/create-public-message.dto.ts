import { IsString, MinLength } from 'class-validator';

export class CreatePublicMessageDto {
  @IsString()
  @MinLength(2)
  body!: string;

  @IsString()
  contact!: string;
}
