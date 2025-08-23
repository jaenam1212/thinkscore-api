import { Module } from "@nestjs/common";
import { AnswersController } from "./answers.controller";
import { AnswersService } from "./answers.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { OpenAIModule } from "../openai/openai.module";

@Module({
  imports: [SupabaseModule, OpenAIModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
