export interface CreateQuestionDto {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  evaluation_criteria: string[];
  is_active?: boolean;
}

export interface UpdateQuestionDto {
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  evaluation_criteria?: string[];
  is_active?: boolean;
}
