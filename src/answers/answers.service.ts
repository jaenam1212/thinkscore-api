import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateAnswerDto } from "../common/dto/answers.dto";
import { Answer } from "../common/types";

@Injectable()
export class AnswersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUserAnswers(userId: string): Promise<Answer[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("answers")
      .select(
        `
        *,
        questions(*),
        scores(*)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Answer[]) || [];
  }

  async getQuestionAnswers(questionId: number): Promise<Answer[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("answers")
      .select(
        `
        *,
        profiles(*),
        scores(*)
      `
      )
      .eq("question_id", questionId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Answer[]) || [];
  }

  async getAnswer(id: number): Promise<Answer> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("answers")
      .select(
        `
        *,
        questions(*),
        profiles(*),
        scores(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return data as Answer;
  }

  async createAnswer(answerData: CreateAnswerDto): Promise<Answer> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("answers")
      .insert(answerData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Answer;
  }
}
