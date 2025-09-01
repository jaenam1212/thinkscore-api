export interface OpenAILog {
  id: number;
  user_id?: string;
  question_id?: number;
  answer_id?: number;
  prompt: string;
  model: string;
  response_text?: string;
  score?: number;
  feedback?: string;
  criteria_scores?: Record<string, number>;
  tokens_used?: number;
  response_time_ms?: number;
  status: "pending" | "success" | "error";
  error_message?: string;
  created_at: string;
  updated_at: string;
}
