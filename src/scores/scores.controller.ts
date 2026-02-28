import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ScoresService } from "./scores.service";
import { CreateScoreDto } from "../common/dto/scores.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

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

  @UseGuards(JwtAuthGuard)
  @Post()
  async createScore(@Body() scoreData: CreateScoreDto) {
    return this.scoresService.createScore(scoreData);
  }

  @Get(":id")
  async getScore(@Param("id") id: string) {
    return this.scoresService.getScore(parseInt(id, 10));
  }
}
