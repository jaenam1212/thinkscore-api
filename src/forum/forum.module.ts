import { Module } from "@nestjs/common";
import { ForumService } from "./forum.service";
import { ForumController } from "./forum.controller";
import { ForumSeedService } from "./forum-seed.service";
import { ForumMigrationService } from "./forum-migration.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [ForumController],
  providers: [ForumService, ForumSeedService, ForumMigrationService],
  exports: [ForumService],
})
export class ForumModule {}
