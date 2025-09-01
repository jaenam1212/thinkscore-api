import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Delete,
  Param,
} from "@nestjs/common";

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    [key: string]: any;
  };
}
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OpenAILogsService } from "./openai-logs.service";

@Controller("openai-logs")
@UseGuards(JwtAuthGuard)
export class OpenAILogsController {
  constructor(private readonly openaiLogsService: OpenAILogsService) {}

  @Get("my-logs")
  async getMyLogs(
    @Request() req: AuthenticatedRequest,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const userId: string = req.user.sub;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.openaiLogsService.getLogsByUserId(userId, limitNum, offsetNum);
  }

  @Get("my-stats")
  async getMyStats(
    @Request() req: AuthenticatedRequest,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string
  ) {
    const userId: string = req.user.sub;
    return this.openaiLogsService.getUsageStats(userId, startDate, endDate);
  }

  @Get("system-stats")
  async getSystemStats(
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string
  ) {
    // Note: 관리자 권한 체크 필요 시 추가 가드 적용
    return this.openaiLogsService.getUsageStats(undefined, startDate, endDate);
  }

  @Get("errors")
  async getErrorLogs(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.openaiLogsService.getLogsByStatus("error", limitNum);
  }

  @Delete("cleanup/:days")
  async cleanupOldLogs(@Param("days") days: string) {
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      throw new Error("Invalid days parameter");
    }

    const deletedCount = await this.openaiLogsService.cleanupOldLogs(daysNum);
    return {
      message: `Successfully deleted ${deletedCount} log entries older than ${daysNum} days`,
      deleted_count: deletedCount,
    };
  }
}
