import { Module } from "@nestjs/common";
import { ForumService } from "./forum.service";
import { ForumController } from "./forum.controller";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
