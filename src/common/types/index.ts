export interface Answer {
  id: number;
  user_id: string;
  question_id: number;
  content: string;
  created_at: string;
  questions?: {
    id: number;
    prompt: string;
    is_active: boolean;
    created_at: string;
  };
  profiles?: {
    id: string;
    display_name?: string;
    created_at: string;
  };
  scores?: Array<{
    id: number;
    answer_id: number;
    score: number;
    reason?: string;
    created_at: string;
  }>;
}

export interface Question {
  id: number;
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  evaluation_criteria: string[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  display_name?: string;
  created_at: string;
  updated_at?: string;
  total_score?: number;
  level?: number;
}

export interface Score {
  id: number;
  answer_id: number;
  score: number;
  reason?: string;
  created_at: string;
  scorer_id?: string;
  is_ai_score: boolean;
}
