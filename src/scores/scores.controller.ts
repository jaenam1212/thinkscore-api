import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { ScoresService } from "./scores.service";
import type { CreateScoreDto } from "../common/dto/scores.dto";

@Controller("scores")
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Get("answer/:answerId")
  async getAnswerScores(@Param("answerId") answerId: string) {
    return this.scoresService.getAnswerScores(parseInt(answerId, 10));
  }

  @Get("user/:userId")
  async getUserScores(@Param("userId") userId: string) {
    return this.scoresService.getUserScores(userId);
  }

  @Post()
  async createScore(@Body() scoreData: CreateScoreDto) {
    return this.scoresService.createScore(scoreData);
  }

  @Get(":id")
  async getScore(@Param("id") id: string) {
    return this.scoresService.getScore(parseInt(id, 10));
  }
}
