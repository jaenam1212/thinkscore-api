import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { SupabaseModule } from "./supabase/supabase.module";
import { AuthModule } from "./auth/auth.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { QuestionsModule } from "./questions/questions.module";
import { AnswersModule } from "./answers/answers.module";
import { ScoresModule } from "./scores/scores.module";
import { OpenAIModule } from "./openai/openai.module";
import { ForumModule } from "./forum/forum.module";
import { RankingsModule } from "./rankings/rankings.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1초
        limit: 3, // 1초당 3회
      },
      {
        name: "medium",
        ttl: 10000, // 10초
        limit: 20, // 10초당 20회
      },
      {
        name: "long",
        ttl: 60000, // 1분
        limit: 100, // 1분당 100회
      },
    ]),
    SupabaseModule,
    AuthModule,
    ProfilesModule,
    QuestionsModule,
    AnswersModule,
    ScoresModule,
    OpenAIModule,
    ForumModule,
    RankingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
