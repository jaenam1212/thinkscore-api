import { IsString, IsOptional, IsNotEmpty, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  category?: string = "free";

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  question_id?: number;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  post_id: number;
}

export class ForumPostResponseDto {
  id: number;
  title: string;
  content: string;
  author_id: string;
  category: string;
  views_count: number;
  likes_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url?: string;
  };
  comments_count?: number;
}

export class ForumCommentResponseDto {
  id: number;
  post_id: number;
  content: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  author?: {
    username: string;
    avatar_url?: string;
  };
}
