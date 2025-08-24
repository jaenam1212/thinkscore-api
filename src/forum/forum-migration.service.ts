import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ForumMigrationService {
  constructor(private supabase: SupabaseService) {}

  async runForumMigrations(): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.supabase.getClient();

      // Test if forum_posts table exists
      const { error } = await client
        .from("forum_posts")
        .select("count", { count: "exact", head: true });

      if (!error) {
        return {
          success: true,
          message: "Forum tables already exist",
        };
      }

      // If tables don't exist, let's try to create them using RPC
      const migrationSQL = `
        -- Create forum posts table
        CREATE TABLE IF NOT EXISTS forum_posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          category VARCHAR(50) DEFAULT 'general',
          views_count INTEGER DEFAULT 0,
          likes_count INTEGER DEFAULT 0,
          is_pinned BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create forum comments table  
        CREATE TABLE IF NOT EXISTS forum_comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create forum likes table
        CREATE TABLE IF NOT EXISTS forum_likes (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
          user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(post_id, user_id)
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON forum_posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);
        CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_forum_comments_author_id ON forum_comments(author_id);
        CREATE INDEX IF NOT EXISTS idx_forum_likes_post_id ON forum_likes(post_id);
        CREATE INDEX IF NOT EXISTS idx_forum_likes_user_id ON forum_likes(user_id);
      `;

      // Execute SQL via RPC if there's an execute_sql function, otherwise manual instruction
      try {
        const { error: rpcError } = await client.rpc("exec_sql", {
          sql: migrationSQL,
        });

        if (rpcError) {
          console.log("RPC execution failed, need manual migration:", rpcError);
          return {
            success: false,
            message:
              "Forum tables do not exist. Please execute the SQL migration manually in Supabase SQL Editor.",
          };
        }

        return {
          success: true,
          message: "Forum tables created successfully via RPC",
        };
      } catch {
        console.log("No exec_sql RPC function available");
        return {
          success: false,
          message:
            "Forum tables need to be created manually. Please execute the migration SQL in Supabase dashboard.",
        };
      }
    } catch (error) {
      console.error("Migration check error:", error);
      return {
        success: false,
        message: `Migration check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
