import { IsNumber, IsOptional, IsString, IsObject, Min, Max } from "class-validator";

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

  @IsObject()
  @IsOptional()
  criteria_scores?: Record<string, number>;
}
