export interface CreateAnswerDto {
  user_id?: string;
  question_id: number;
  content: string;
  is_anonymous?: boolean;
}
