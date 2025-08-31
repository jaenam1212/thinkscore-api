import { Module } from "@nestjs/common";
import { RankingsController } from "./rankings.controller";
import { RankingsService } from "./rankings.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}
