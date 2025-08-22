import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // 임시로 하드코딩 (실제로는 환경변수 사용)
    const supabaseUrl =
      process.env.SUPABASE_URL || "https://your-project.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key";

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
