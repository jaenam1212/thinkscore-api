import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AnswersController } from "./answers.controller";
import { AnswersService } from "./answers.service";
import { SupabaseModule } from "../supabase/supabase.module";
import { OpenAIModule } from "../openai/openai.module";

@Module({
  imports: [
    SupabaseModule,
    OpenAIModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET environment variable is required");
        }
        return {
          secret,
          signOptions: { expiresIn: "1h" },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
