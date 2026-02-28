import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from "class-validator";

export class CreateAnswerDto {
  @IsString()
  @IsOptional()
  user_id?: string;

  @IsNumber()
  @IsNotEmpty()
  question_id: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;
}
