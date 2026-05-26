import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class FirebaseAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken!: string;
}
