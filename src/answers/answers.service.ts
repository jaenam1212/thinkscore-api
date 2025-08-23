import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OpenAIService } from "../openai/openai.service";
import { CreateAnswerDto } from "../common/dto/answers.dto";
import { Answer } from "../common/types";

@Injectable()
export class AnswersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly openaiService: OpenAIService
  ) {}

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

  async evaluateAnswer(answerId: number): Promise<any> {
    // 답변과 관련 질문 정보 가져오기
    const answer = await this.getAnswer(answerId);

    if (!answer.questions) {
      throw new Error("질문 정보를 찾을 수 없습니다.");
    }

    // OpenAI로 평가 실행
    const questions = answer.questions as {
      prompt: string;
      evaluation_criteria?: string[];
    };
    const evaluation = await this.openaiService.evaluateAnswer(
      questions.prompt,
      answer.content,
      questions.evaluation_criteria || []
    );

    // 점수를 scores 테이블에 저장
    const { data: scoreData, error: scoreError } = (await this.supabaseService
      .getClient()
      .from("scores")
      .insert({
        answer_id: answerId,
        score: evaluation.score,
        reason: evaluation.feedback,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()) as { data: any; error: any };

    if (scoreError) {
      console.error("Score save error:", scoreError);
    }

    return {
      ...evaluation,
      scoreRecord: scoreData,
    };
  }
}
