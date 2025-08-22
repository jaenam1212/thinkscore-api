import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  CreateQuestionDto,
  UpdateQuestionDto,
} from "../common/dto/questions.dto";
import { Question } from "../common/types";
import * as fs from "fs";
import * as path from "path";

interface SeedQuestion {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  evaluation_criteria: string[];
}

@Injectable()
export class QuestionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getActiveQuestions(): Promise<Question[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data as Question[]) || [];
  }

  async getQuestion(id: number): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }

  async createQuestion(questionData: CreateQuestionDto): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .insert(questionData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }

  async updateQuestion(
    id: number,
    updateData: UpdateQuestionDto
  ): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Question;
  }

  // 시드 데이터를 DB에 로드하는 메서드
  async seedQuestions(): Promise<string> {
    try {
      // 여러 경로 시도
      const possiblePaths = [
        path.join(__dirname, "seed-data.json"),
        path.join(process.cwd(), "src", "questions", "seed-data.json"),
        path.join(process.cwd(), "dist", "questions", "seed-data.json"),
      ];

      let seedFilePath = "";
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          seedFilePath = p;
          break;
        }
      }

      if (!seedFilePath) {
        throw new Error(
          `Seed file not found. Tried paths: ${possiblePaths.join(", ")}`
        );
      }

      console.log("Using seed file path:", seedFilePath);
      const seedData = JSON.parse(
        fs.readFileSync(seedFilePath, "utf8")
      ) as SeedQuestion[];

      // 기존 데이터 삭제 (선택사항)
      await this.supabaseService
        .getClient()
        .from("questions")
        .delete()
        .neq("id", 0);

      // 새 데이터 삽입
      const { error } = await this.supabaseService
        .getClient()
        .from("questions")
        .insert(
          seedData.map((item) => ({
            title: item.title,
            description: item.description,
            content: item.content,
            category: item.category,
            difficulty: item.difficulty,
            tags: item.tags,
            evaluation_criteria: item.evaluation_criteria,
            is_active: true,
            created_at: new Date().toISOString(),
          }))
        );

      if (error) throw new Error(error.message);

      return `Successfully seeded ${seedData.length} questions`;
    } catch (error) {
      throw new Error(`Failed to seed questions: ${(error as Error).message}`);
    }
  }

  // 오늘의 문제 가져오기 (날짜 기반)
  async getTodaysQuestion(): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .select("*")
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      throw new Error("No active questions found");
    }

    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        86400000
    );
    const questionIndex = dayOfYear % data.length;

    return data[questionIndex] as Question;
  }

  // 랜덤 문제 가져오기
  async getRandomQuestion(): Promise<Question> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .select("*")
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      throw new Error("No active questions found");
    }

    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex] as Question;
  }
}
