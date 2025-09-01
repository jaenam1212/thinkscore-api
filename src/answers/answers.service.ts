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
    try {
      // 익명 사용자 처리 - user_id가 없으면 null로 설정
      const insertData = {
        question_id: answerData.question_id,
        content: answerData.content,
        user_id: answerData.user_id || null,
        is_anonymous: answerData.is_anonymous || false,
      };

      const { data, error } = await this.supabaseService
        .getClient()
        .from("answers")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Database error details:", error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data as Answer;
    } catch (error) {
      console.error("CreateAnswer error:", error);
      throw error;
    }
  }

  async evaluateAnswer(answerId: number): Promise<any> {
    // 답변과 관련 질문 정보 가져오기
    const answer = await this.getAnswer(answerId);

    if (!answer.questions) {
      throw new Error("질문 정보를 찾을 수 없습니다.");
    }

    // OpenAI로 평가 실행
    const questions = answer.questions as {
      content: string;
      evaluation_criteria?: string[];
    };

    // TODO: 향후 문제별 특화된 평가 기준 사용 고려
    // 현재는 모든 문제를 "논리적 사고, 창의적 사고, 일관성"으로 통일 평가
    // 나중에 questions.evaluation_criteria를 활용하여 문제 유형별 세분화된 평가 가능
    // 예: 윤리 문제 - 도덕적 추론, 가치 판단 / 과학 문제 - 개념 이해, 논리적 분석 등
    const evaluation = await this.openaiService.evaluateAnswer(
      questions.content,
      answer.content
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
