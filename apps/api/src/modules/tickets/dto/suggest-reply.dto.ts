import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operatorNote?: string;
}
