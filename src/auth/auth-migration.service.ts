import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class AuthMigrationService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addSocialLoginFields() {
    const client = this.supabaseService.getClient();

    try {
      // Add columns if they don't exist
      await client.rpc("exec", {
        sql: `
          DO $$ 
          BEGIN
            -- Add social login ID columns
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='kakao_id') THEN
              ALTER TABLE profiles ADD COLUMN kakao_id VARCHAR(255) UNIQUE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='google_id') THEN
              ALTER TABLE profiles ADD COLUMN google_id VARCHAR(255) UNIQUE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='naver_id') THEN
              ALTER TABLE profiles ADD COLUMN naver_id VARCHAR(255) UNIQUE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='apple_id') THEN
              ALTER TABLE profiles ADD COLUMN apple_id VARCHAR(255) UNIQUE;
            END IF;

            -- Add avatar_url column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
              ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
            END IF;

            -- Add username column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
              ALTER TABLE profiles ADD COLUMN username VARCHAR(100) UNIQUE;
            END IF;

            -- Add provider column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='provider') THEN
              ALTER TABLE profiles ADD COLUMN provider VARCHAR(50) DEFAULT 'local';
            END IF;

            -- Add last_login_at column if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_login_at') THEN
              ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
            END IF;
          END $$;
        `,
      });

      // Create indexes
      await client.rpc("exec", {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_profiles_kakao_id ON profiles(kakao_id);
          CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON profiles(google_id);
          CREATE INDEX IF NOT EXISTS idx_profiles_naver_id ON profiles(naver_id);
          CREATE INDEX IF NOT EXISTS idx_profiles_apple_id ON profiles(apple_id);
          CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
          CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);
        `,
      });

      // Update existing profiles to have username
      await client.rpc("exec", {
        sql: `
          UPDATE profiles 
          SET username = COALESCE(display_name, split_part(email, '@', 1))
          WHERE username IS NULL AND (display_name IS NOT NULL OR email IS NOT NULL);
        `,
      });

      return {
        success: true,
        message: "Social login fields added successfully",
      };
    } catch (error) {
      console.error("Migration failed:", error);
      throw new Error(`Migration failed: ${(error as Error).message}`);
    }
  }
}
