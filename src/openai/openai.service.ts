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
    const prompt = `
철학적 질문에 대한 답변을 평가해주세요.

질문: ${question}

답변: ${answer}

평가 기준: ${criteria.join(", ")}

다음 형식으로 평가해주세요:
1. 전체 점수 (0-100점)
2. 각 기준별 점수 (0-100점)
3. 상세 피드백

응답 형식 (JSON):
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
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 철학적 사고를 평가하는 전문가입니다. 논리적 일관성, 창의성, 깊이를 중요하게 평가합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
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
