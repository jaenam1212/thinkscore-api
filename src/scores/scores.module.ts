import { Module } from "@nestjs/common";
import { ScoresController } from "./scores.controller";
import { ScoresService } from "./scores.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [ScoresController],
  providers: [ScoresService],
})
export class ScoresModule {}
