import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsIn,
  IsArray,
  MaxLength,
} from "class-validator";

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsIn(["easy", "medium", "hard"])
  difficulty: "easy" | "medium" | "hard";

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @IsString({ each: true })
  evaluation_criteria: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsIn(["easy", "medium", "hard"])
  @IsOptional()
  difficulty?: "easy" | "medium" | "hard";

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  evaluation_criteria?: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
