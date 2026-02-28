import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Req,
} from "@nestjs/common";
import { AnswersService } from "./answers.service";
import { CreateAnswerDto } from "../common/dto/answers.dto";
import type { Request } from "express";

@Controller("answers")
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Get("user/:userId")
  async getUserAnswers(@Param("userId") userId: string) {
    return this.answersService.getUserAnswers(userId);
  }

  @Get("question/:questionId")
  async getQuestionAnswers(@Param("questionId") questionId: string) {
    return this.answersService.getQuestionAnswers(parseInt(questionId, 10));
  }

  @Post()
  async createAnswer(
    @Body() answerData: CreateAnswerDto,
    @Headers("authorization") authorizationHeader: string | undefined,
    @Req() req: Request
  ) {
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp =
      typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : undefined;

    return this.answersService.createAnswer(answerData, {
      authorizationHeader,
      ip: forwardedIp || req.ip,
      userAgent:
        typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"]
          : undefined,
    });
  }

  @Get(":id")
  async getAnswer(@Param("id") id: string) {
    return this.answersService.getAnswer(parseInt(id, 10));
  }

  @Post(":id/evaluate")
  async evaluateAnswer(@Param("id") id: string): Promise<{
    score: number;
    feedback: string;
    criteriaScores: Record<string, unknown>;
    scoreRecord?: unknown;
  }> {
    return this.answersService.evaluateAnswer(parseInt(id, 10));
  }
}
