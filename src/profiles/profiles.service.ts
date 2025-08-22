import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { CreateProfileDto, UpdateProfileDto } from "../common/dto/profiles.dto";
import { Profile } from "../common/types";

@Injectable()
export class ProfilesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(id: string): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  }

  async createProfile(profileData: CreateProfileDto): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .insert(profileData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  }

  async updateProfile(
    id: string,
    updateData: UpdateProfileDto
  ): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  }
}
