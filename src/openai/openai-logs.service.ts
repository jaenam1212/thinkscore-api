import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { OpenAILog } from "../common/types/openai.types";

@Injectable()
export class OpenAILogsService {
  constructor(private supabaseService: SupabaseService) {}

  async getLogsByUserId(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<OpenAILog[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("openai_logs")
      .select(
        `
        *,
        questions(id, title, content),
        answers(id, content),
        profiles(id, display_name)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }

    return data as OpenAILog[];
  }

  async getLogsByStatus(
    status: "pending" | "success" | "error",
    limit: number = 100
  ): Promise<OpenAILog[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("openai_logs")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch logs by status: ${error.message}`);
    }

    return data as OpenAILog[];
  }

  async getUsageStats(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    total_calls: number;
    success_calls: number;
    error_calls: number;
    total_tokens: number;
    avg_response_time: number;
    avg_score: number;
  }> {
    let query = this.supabaseService
      .getClient()
      .from("openai_logs")
      .select("status, tokens_used, response_time_ms, score");

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch usage stats: ${error.message}`);
    }

    const stats = data.reduce(
      (
        acc,
        log: {
          status: string;
          tokens_used?: number;
          response_time_ms?: number;
          score?: number;
        }
      ) => {
        acc.total_calls++;
        if (log.status === "success") acc.success_calls++;
        if (log.status === "error") acc.error_calls++;
        if (log.tokens_used) acc.total_tokens += Number(log.tokens_used);
        if (log.response_time_ms)
          acc.response_times.push(Number(log.response_time_ms));
        if (log.score) acc.scores.push(Number(log.score));
        return acc;
      },
      {
        total_calls: 0,
        success_calls: 0,
        error_calls: 0,
        total_tokens: 0,
        response_times: [] as number[],
        scores: [] as number[],
      }
    );

    return {
      total_calls: stats.total_calls,
      success_calls: stats.success_calls,
      error_calls: stats.error_calls,
      total_tokens: stats.total_tokens,
      avg_response_time:
        stats.response_times.length > 0
          ? Math.round(
              stats.response_times.reduce((a, b) => a + b, 0) /
                stats.response_times.length
            )
          : 0,
      avg_score:
        stats.scores.length > 0
          ? Math.round(
              (stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) *
                100
            ) / 100
          : 0,
    };
  }

  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await this.supabaseService
      .getClient()
      .from("openai_logs")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      throw new Error(`Failed to cleanup logs: ${error.message}`);
    }

    return data?.length || 0;
  }
}
