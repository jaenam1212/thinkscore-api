import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  RankingsService,
  RankingUser,
  QuestionRankingUser,
  UserRank,
  RankingStats,
} from "./rankings.service";

interface JwtRequest extends ExpressRequest {
  user: {
    userId: string;
    id: string;
  };
}

@Controller("rankings")
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get("overall")
  async getOverallRankings(
    @Query("limit") limit?: string
  ): Promise<RankingUser[]> {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    return this.rankingsService.getOverallRankings(limitNumber);
  }

  @Get("question/:questionId")
  async getQuestionRankings(
    @Param("questionId", ParseIntPipe) questionId: number,
    @Query("limit") limit?: string
  ): Promise<QuestionRankingUser[]> {
    const limitNumber = limit ? parseInt(limit, 10) : 50;
    return this.rankingsService.getQuestionRankings(questionId, limitNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-rank/overall")
  async getMyOverallRank(@Request() req: JwtRequest): Promise<UserRank> {
    return this.rankingsService.getMyOverallRank(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-rank/question/:questionId")
  async getMyQuestionRank(
    @Param("questionId", ParseIntPipe) questionId: number,
    @Request() req: JwtRequest
  ): Promise<UserRank> {
    return this.rankingsService.getMyQuestionRank(req.user.id, questionId);
  }

  @Get("stats")
  async getRankingStats(): Promise<RankingStats> {
    return this.rankingsService.getRankingStats();
  }
}
