import { IsString } from 'class-validator';

export class MergeCitizenDto {
  @IsString()
  mergeIntoId!: string;
}
