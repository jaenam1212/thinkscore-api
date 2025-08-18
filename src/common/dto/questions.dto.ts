export interface CreateQuestionDto {
  prompt: string;
  is_active?: boolean;
}

export interface UpdateQuestionDto {
  prompt?: string;
  is_active?: boolean;
}