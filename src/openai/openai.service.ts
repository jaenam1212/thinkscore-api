import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";
import { SupabaseService } from "../supabase/supabase.service";

interface OpenAILogEntry {
  id: number;
  user_id?: string;
  question_id?: number;
  answer_id?: number;
  prompt: string;
  model: string;
  status: string;
}

@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });
  }

  async evaluateAnswer(
    question: string,
    answer: string,
    userId?: string,
    questionId?: number,
    answerId?: number
  ): Promise<{
    score: number;
    feedback: string;
    criteriaScores: Record<string, number>;
  }> {
    // 1. 숫자만 입력된 경우
    const onlyNumbers = /^[\d\s.,+-]+$/.test(answer.trim());
    if (onlyNumbers) {
      return {
        score: 0,
        feedback:
          "숫자만 입력된 답변은 평가할 수 없습니다. 생각과 근거를 문장으로 서술해 주세요.",
        criteriaScores: {
          "논리적 사고": 0,
          "창의적 사고": 0,
          일관성: 0,
        },
      };
    }

    // 2. 무의미한 문자 (키보드 난타, 반복 문자 등)
    const koreanOrHangulJamo = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
    const meaningfulWord = /[a-zA-Z가-힣]{2,}/;
    const hasMinLength = answer.trim().length >= 10;
    const looksLikeRandomChars =
      !koreanOrHangulJamo.test(answer) &&
      !/[a-zA-Z]{3,}/.test(answer) &&
      !/\d/.test(answer);
    const noMeaningfulContent =
      !meaningfulWord.test(answer) && answer.trim().length > 0;
    if (
      (looksLikeRandomChars && hasMinLength) ||
      (noMeaningfulContent && !/[가-힣]/.test(answer))
    ) {
      return {
        score: 0,
        feedback:
          "의미 있는 서술이 감지되지 않았습니다. 질문에 대한 생각을 문장으로 표현해 주세요.",
        criteriaScores: {
          "논리적 사고": 0,
          "창의적 사고": 0,
          일관성: 0,
        },
      };
    }

    // 3. 욕설 및 부적절한 내용
    const profanityPatterns = [
      // 한국어 욕설
      /시발|씨발|ㅅㅂ|씹|개새|개쌔|병신|ㅂㅅ|존나|ㅈㄴ|지랄|ㅈㄹ|미친|ㅁㅊ|새끼|ㅅㄲ|니미|느금|보지|자지|창녀|걸레|년|놈|찐따|장애|빻은|빠가|빡대가리|꺼져|닥쳐/i,
      // 영어 욕설
      /\bfuck|\bshit|\bass\b|\bbitch|\bcunt|\bdick\b|\bpussy|\bfaggot|\bwhore/i,
    ];
    const hasProfanity = profanityPatterns.some((pattern) =>
      pattern.test(answer)
    );

    // 4. 무성의한 답변 ("모르겠다", "모름", "패스" 등 단순 회피)
    const dismissivePatterns =
      /^(모르겠|모르겟|몰라|모름|모르|패스|pass|skip|그냥|없음|없어|ㅁㄹ|ㅁ|\?+|\.\.+|-+){1,3}[.!?\s]*$/i;
    const isDismissive =
      dismissivePatterns.test(answer.trim()) && answer.trim().length < 20;

    if (hasProfanity) {
      return {
        score: 0,
        feedback:
          "부적절한 내용이 포함되어 있어 평가할 수 없습니다. 건전한 언어로 다시 작성해 주세요.",
        criteriaScores: {
          "논리적 사고": 0,
          "창의적 사고": 0,
          일관성: 0,
        },
      };
    }

    if (isDismissive) {
      return {
        score: 0,
        feedback:
          "답변이 너무 짧거나 성의 없이 작성되었습니다. 질문에 대한 구체적인 생각을 서술해 주세요.",
        criteriaScores: {
          "논리적 사고": 0,
          "창의적 사고": 0,
          일관성: 0,
        },
      };
    }

    const bannedBullets = /[•●○◦▪▫■□◆◇▶▷➤➔\-\u2022]/;
    const bannedEmojis = /\p{Extended_Pictographic}/u;

    if (bannedBullets.test(answer) || bannedEmojis.test(answer)) {
      return {
        score: 0,
        feedback: "AI 치팅이 의심됩니다",
        criteriaScores: {
          "논리적 사고": 0,
          "창의적 사고": 0,
          일관성: 0,
        },
      };
    }

    const input = `
다음 철학적 질문에 대한 답변을 3가지 기준으로 평가하세요.

**질문**: ${question}

**답변**: ${answer}

**평가 기준**:
1. **논리적 사고** (40%): 논리 구조, 인과관계, 반박에 대한 처리
2. **창의적 사고** (30%): 새로운 관점, 독창적 접근, 적절한 비유
3. **일관성** (30%): 자기모순 부재, 결론과 논증의 정합성

**채점 방식**:
- 각 기준마다 0-100점 (정수)
- 총점 = round(논리적 사고 × 0.4 + 창의적 사고 × 0.3 + 일관성 × 0.3)
- 길이보다는 질을 중시하여 평가
- 길다고 감점은 아님
- 점수는 넉넉하게 준다
- 철학적 사고를 평가하는 전문가입니다. 논리적 일관성, 창의성, 깊이를 중요하게 평가합니다.

**피드백 형식**: 정확히 2문장 (첫 번째 문장=강점, 두 번째 문장=개선점)

**응답 형식** (JSON만):
{
  "score": 총점,
  "feedback": "강점: [구체적 강점]. 개선점: [구체적 개선사항].",
  "criteriaScores": {
    "논리적 사고": 점수,
    "창의적 사고": 점수,
    "일관성": 점수
  }
}
`;

    const startTime = Date.now();
    const model = "gpt-5-nano";

    // Create initial log entry
    const supabase = this.supabaseService.getClient();
    const result = await supabase
      .from("openai_logs")
      .insert({
        user_id: userId,
        question_id: questionId,
        answer_id: answerId,
        prompt: input,
        model: model,
        status: "pending",
      })
      .select()
      .single();

    const logEntry = result.data as OpenAILogEntry;

    if (!logEntry) {
      throw new Error("로그 엔트리 생성에 실패했습니다.");
    }

    try {
      const response = await this.openai.responses.create({
        model: model,
        input: input,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
      });

      const responseTime = Date.now() - startTime;
      const content = response.output_text;

      if (!content) {
        throw new Error("OpenAI 응답이 비어있습니다.");
      }

      const result = JSON.parse(content) as {
        score: number;
        feedback: string;
        criteriaScores: Record<string, number>;
      };

      // Update log with successful response
      if (logEntry) {
        await supabase
          .from("openai_logs")
          .update({
            response_text: content,
            score: result.score,
            feedback: result.feedback,
            criteria_scores: result.criteriaScores,
            tokens_used: response.usage?.total_tokens || null,
            response_time_ms: responseTime,
            status: "success",
            updated_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", logEntry.id);
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error("OpenAI API Error:", error);

      // Update log with error information
      if (logEntry) {
        await supabase
          .from("openai_logs")
          .update({
            status: "error",
            error_message:
              error instanceof Error ? error.message : "Unknown error",
            response_time_ms: responseTime,
            updated_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", logEntry.id);
      }

      throw new Error("답변 평가 중 오류가 발생했습니다.");
    }
  }
}
