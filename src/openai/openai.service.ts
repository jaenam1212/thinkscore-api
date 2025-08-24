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
    answer: string,
    criteria: string[]
  ): Promise<{
    score: number;
    feedback: string;
    criteriaScores: Record<string, number>;
  }> {
    const input = `
철학적 질문에 대한 답변을 평가해주세요.

질문: ${question}

답변: ${answer}

평가 기준: ${criteria.join(", ")}

채점 축: 분석(논리 구조·인과·반론처리), 창의(새 관점·적절한 비유), 일관성(자기모순 부재·결론 정합성)
각 축 점수는 0~100 정수. 총점 = round(0.4*분석 + 0.3*창의 + 0.3*일관성)
길이 편향 금지(장황·중복 시 감점). 피드백은 정확히 2문장: 1문장=강점, 1문장=개선점
입력 criteria가 주어지면 그 이름을 그대로 사용해 criteriaScores 키를 채운다(미매칭 시 가장 근접 축에 매핑)

JSON 형식으로만 응답:
{
  "score": 전체점수,
  "feedback": "상세한 피드백",
  "criteriaScores": {
    "기준1": 점수,
    "기준2": 점수
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
