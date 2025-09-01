import { Controller, Get, Post, Body, Param, Put } from "@nestjs/common";
import { QuestionsService } from "./questions.service";
import type {
  CreateQuestionDto,
  UpdateQuestionDto,
} from "../common/dto/questions.dto";

@Controller("questions")
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  async getActiveQuestions() {
    return this.questionsService.getActiveQuestions();
  }

  @Get("list")
  async getQuestionsList() {
    return this.questionsService.getQuestionsForSelection();
  }

  @Get("today")
  async getTodaysQuestion() {
    return this.questionsService.getTodaysQuestion();
  }

  @Get("random")
  async getRandomQuestion() {
    return this.questionsService.getRandomQuestion();
  }

  @Get(":id")
  async getQuestion(@Param("id") id: string) {
    return this.questionsService.getQuestion(parseInt(id, 10));
  }

  @Post()
  async createQuestion(@Body() questionData: CreateQuestionDto) {
    return this.questionsService.createQuestion(questionData);
  }

  @Put(":id")
  async updateQuestion(
    @Param("id") id: string,
    @Body() updateData: UpdateQuestionDto
  ) {
    return this.questionsService.updateQuestion(parseInt(id, 10), updateData);
  }

  @Post("seed")
  async seedQuestions() {
    return { message: await this.questionsService.seedQuestions() };
  }

  @Post(":id/enable-forum")
  async enableQuestionForum(@Param("id") id: string) {
    return this.questionsService.enableQuestionForum(parseInt(id, 10));
  }

  @Post("publish-daily")
  async publishDailyQuestion() {
    await this.questionsService.publishDailyQuestion();
    return { message: "Daily question publishing job executed" };
  }
}
