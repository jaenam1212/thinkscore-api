import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OpenAI } from "openai";

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>("OPENAI_API_KEY"),
    });
  }

  async evaluateAnswer(
    question: string,
    answer: string
  ): Promise<{
    score: number;
    feedback: string;
    criteriaScores: Record<string, number>;
  }> {
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
- 길이보다는 질을 중시하여 평가 (장황함이나 중복은 감점)

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

    try {
      const response = await this.openai.responses.create({
        model: "gpt-5-nano",
        input: input,
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
      });

      const content = response.output_text;
      if (!content) {
        throw new Error("OpenAI 응답이 비어있습니다.");
      }

      const result = JSON.parse(content) as {
        score: number;
        feedback: string;
        criteriaScores: Record<string, number>;
      };
      return result;
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw new Error("답변 평가 중 오류가 발생했습니다.");
    }
  }
}
