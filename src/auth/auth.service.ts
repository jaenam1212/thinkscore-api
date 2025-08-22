import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

interface ProfileData {
  display_name?: string;
  email?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async signInWithProvider(provider: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/callback`,
        },
      });

    if (error) throw new Error(error.message);
    return data;
  }

  async signOut() {
    const { error } = await this.supabaseService.getClient().auth.signOut();
    if (error) throw new Error(error.message);
    return { message: "Signed out successfully" };
  }

  async getUser(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async createOrUpdateProfile(userId: string, profileData: ProfileData) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .upsert({
        id: userId,
        display_name: profileData.display_name || profileData.email,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getSession() {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.getSession();

    if (error) throw new Error(error.message);
    return data;
  }
}
