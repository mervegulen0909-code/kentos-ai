import { IsOptional, IsString } from 'class-validator';

export class AssignTicketDto {
  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
