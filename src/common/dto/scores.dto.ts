import { IsNumber, IsOptional, IsString, Min, Max } from "class-validator";

export class CreateScoreDto {
  @IsNumber()
  answer_id: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
