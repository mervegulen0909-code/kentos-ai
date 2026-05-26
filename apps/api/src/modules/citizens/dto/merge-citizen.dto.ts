import { IsNotEmpty, IsString } from 'class-validator';

export class MergeCitizenDto {
  @IsString()
  @IsNotEmpty()
  mergeIntoId!: string;
}
