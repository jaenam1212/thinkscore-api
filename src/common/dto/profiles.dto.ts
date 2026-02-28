import { IsString, IsOptional, IsNotEmpty, MaxLength } from "class-validator";

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  display_name?: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  display_name?: string;
}
