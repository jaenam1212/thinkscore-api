import { Module } from "@nestjs/common";
import { OpenAIService } from "./openai.service";
import { OpenAILogsService } from "./openai-logs.service";
import { OpenAILogsController } from "./openai-logs.controller";
import { SupabaseModule } from "../supabase/supabase.module";
import { AdminGuard } from "../auth/guards/admin.guard";

@Module({
  imports: [SupabaseModule],
  controllers: [OpenAILogsController],
  providers: [OpenAIService, OpenAILogsService, AdminGuard],
  exports: [OpenAIService, OpenAILogsService],
})
export class OpenAIModule {}
