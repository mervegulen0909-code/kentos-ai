import { IsString, MinLength } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(2)
  body!: string;
}
