import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
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
  private readonly logger = new Logger(QuestionsService.name);

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

  // 문제 선택용 목록 (간단한 정보만)
  async getQuestionsForSelection() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("questions")
      .select("id, title, description, category, difficulty, tags")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    return (
      data?.map((question) => ({
        id: question.id,
        title: question.title,
        description: question.description,
        category: question.category,
        difficulty: question.difficulty,
        tags: question.tags,
      })) || []
    );
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

  // 매일 자정에 실행되는 Cron Job
  @Cron("0 0 * * *") // 초 분 시 일 월 요일
  async publishDailyQuestion() {
    this.logger.log("Running daily question publishing job...");

    try {
      const today = new Date();
      const todayString = today.toISOString().split("T")[0]; // YYYY-MM-DD 형식

      // 이미 오늘 실행되었는지 확인
      const lastRunKey = `last_daily_publish_${todayString}`;
      const lastRun = global[lastRunKey];

      if (lastRun) {
        this.logger.log("Daily question publishing already executed today");
        return;
      }

      this.logger.log(`Looking for questions to publish on ${todayString}`);

      // 오늘 출시되어야 할 문제들을 찾아서 포럼을 활성화
      const { data: questionsToPublish, error: findError } =
        await this.supabaseService
          .getClient()
          .from("questions")
          .select("id, title, published_at")
          .eq("forum_enabled", false)
          .gte("published_at", todayString)
          .lt(
            "published_at",
            new Date(today.getTime() + 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
          );

      if (findError) {
        this.logger.error("Error finding questions to publish:", findError);
        return;
      }

      if (!questionsToPublish || questionsToPublish.length === 0) {
        this.logger.log("No questions to publish today");
        return;
      }

      this.logger.log(
        `Found ${questionsToPublish.length} questions to publish:`,
        questionsToPublish.map((q) => q.title)
      );

      // 찾은 문제들의 포럼을 활성화
      const { data: updatedQuestions, error: updateError } =
        await this.supabaseService
          .getClient()
          .from("questions")
          .update({
            forum_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .in(
            "id",
            questionsToPublish.map((q) => q.id)
          )
          .select("id, title");

      if (updateError) {
        this.logger.error("Error updating questions:", updateError);
        return;
      }

      this.logger.log(
        `Successfully published forums for ${updatedQuestions?.length || 0} questions`
      );

      // 실행 완료 표시
      global[lastRunKey] = new Date().toISOString();
    } catch (error) {
      this.logger.error("Daily question publishing job failed:", error);
    }
  }

  // 서버 시작 시 오늘 문제 확인 (선택사항)
  async checkTodaysQuestion() {
    this.logger.log("Checking if today's question forum is enabled...");

    // 이미 오늘 실행되었는지 확인
    const today = new Date().toISOString().split("T")[0];
    const lastRunKey = `last_daily_publish_${today}`;

    // Redis나 메모리에 마지막 실행 시간 저장 (간단한 구현)
    // 실제로는 Redis나 DB에 저장하는 것이 좋음
    const lastRun = global[lastRunKey];

    if (lastRun) {
      this.logger.log("Daily question publishing already executed today");
      return;
    }

    await this.publishDailyQuestion();
    global[lastRunKey] = new Date().toISOString();
  }

  // 수동으로 특정 문제의 포럼을 활성화하는 메서드
  async enableQuestionForum(
    questionId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from("questions")
        .update({
          forum_enabled: true,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .select("id, title")
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: `Forum enabled for question: ${data.title}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to enable forum: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
