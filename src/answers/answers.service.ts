import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OpenAIService } from "../openai/openai.service";
import { CreateAnswerDto } from "../common/dto/answers.dto";
import { Answer } from "../common/types";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";

type ActorType = "anonymous" | "user" | "premium";

interface AuthContext {
  authorizationHeader?: string;
  ip?: string;
  userAgent?: string;
}

interface ResolvedActor {
  type: ActorType;
  userId: string | null;
  submitterKey: string;
}

interface JwtPayload {
  sub: string;
}

const DAILY_LIMITS: Record<ActorType, number> = {
  anonymous: 3,
  user: 7,
  premium: 50,
};

const DAILY_LIMIT_MESSAGES: Record<ActorType, string> = {
  anonymous:
    "비로그인 사용자는 하루 3회까지 답변을 제출할 수 있습니다. 로그인하면 하루 7회까지 가능합니다.",
  user: "일반 사용자는 하루 7회까지 답변을 제출할 수 있습니다. 프리미엄은 하루 50회까지 가능합니다.",
  premium: "프리미엄 사용자는 하루 50회까지 답변을 제출할 수 있습니다.",
};

@Injectable()
export class AnswersService {
  private readonly logger = new Logger(AnswersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly openaiService: OpenAIService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private getKstDayRange() {
    const now = new Date();
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const startUtc = new Date(`${ymd}T00:00:00+09:00`).toISOString();
    const endUtc = new Date(`${ymd}T23:59:59.999+09:00`).toISOString();

    return { startUtc, endUtc, ymd };
  }

  private parseUserIdFromAuthHeader(
    authorizationHeader?: string
  ): string | null {
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();
    if (!token) {
      return null;
    }

    const jwtSecret = this.configService.get<string>("JWT_SECRET");
    if (!jwtSecret) {
      throw new InternalServerErrorException("JWT secret is not configured");
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: jwtSecret,
      });
      return payload.sub || null;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private async isPremiumUser(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("subscriptions")
      .select("is_premium, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Subscription lookup failed for user ${userId}:`,
        error
      );
      return false;
    }

    if (!data?.is_premium) {
      return false;
    }

    if (!data.expires_at) {
      return true;
    }

    const expiresAt = data.expires_at as string | number | Date;
    return new Date(expiresAt) > new Date();
  }

  private async resolveActor(context?: AuthContext): Promise<ResolvedActor> {
    const userId = this.parseUserIdFromAuthHeader(context?.authorizationHeader);
    if (userId) {
      const premium = await this.isPremiumUser(userId);
      return {
        type: premium ? "premium" : "user",
        userId,
        submitterKey: `user:${userId}`,
      };
    }

    const ip = context?.ip || "unknown-ip";
    const ua = context?.userAgent || "unknown-ua";
    const fingerprint = createHash("sha256")
      .update(`${ip}|${ua}`)
      .digest("hex");

    return {
      type: "anonymous",
      userId: null,
      submitterKey: `anon:${fingerprint}`,
    };
  }

  private async enforceDailyLimit(actor: ResolvedActor): Promise<void> {
    const { startUtc, endUtc } = this.getKstDayRange();

    let query = this.supabaseService
      .getClient()
      .from("answers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startUtc)
      .lte("created_at", endUtc);

    if (actor.userId) {
      query = query.eq("user_id", actor.userId);
    } else {
      query = query.eq("submitter_key", actor.submitterKey);
    }

    const { count, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const used = count || 0;
    const limit = DAILY_LIMITS[actor.type];
    if (used >= limit) {
      throw new HttpException(
        DAILY_LIMIT_MESSAGES[actor.type],
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

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

    if (error) throw new InternalServerErrorException(error.message);
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

    if (error) throw new InternalServerErrorException(error.message);
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

    if (error) throw new NotFoundException(error.message);
    return data as Answer;
  }

  async createAnswer(
    answerData: CreateAnswerDto,
    context?: AuthContext
  ): Promise<Answer> {
    const actor = await this.resolveActor(context);
    await this.enforceDailyLimit(actor);

    const insertData = {
      question_id: answerData.question_id,
      content: answerData.content,
      user_id: actor.userId,
      is_anonymous: actor.userId === null,
      submitter_key: actor.submitterKey,
    };

    const { data, error } = await this.supabaseService
      .getClient()
      .from("answers")
      .insert(insertData)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    return data as Answer;
  }

  async evaluateAnswer(answerId: number): Promise<any> {
    const { data: existingScore, error: existingScoreError } =
      await this.supabaseService
        .getClient()
        .from("scores")
        .select("*")
        .eq("answer_id", answerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingScoreError) {
      throw new InternalServerErrorException(existingScoreError.message);
    }

    if (existingScore) {
      const score = existingScore as { score: number; reason: string };
      return {
        score: score.score,
        feedback: score.reason,
        criteriaScores: {},
        scoreRecord: existingScore,
      };
    }

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
      answer.content,
      answer.user_id,
      answer.question_id,
      answer.id
    );

    // 점수를 scores 테이블에 저장
    const { data: scoreData, error: scoreError } = await this.supabaseService
      .getClient()
      .from("scores")
      .insert({
        answer_id: answerId,
        score: evaluation.score,
        reason: evaluation.feedback,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scoreError) {
      this.logger.error("Score save error:", scoreError);
    }

    return {
      ...evaluation,
      scoreRecord: scoreData ?? undefined,
    };
  }
}
