import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { SupabaseService } from "../supabase/supabase.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

interface ProfileData {
  display_name?: string;
  email?: string;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService
  ) {}

  async signInWithProvider(provider: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithOAuth({
        provider: provider as "google" | "github" | "discord",
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

  // JWT 기반 회원가입/로그인 메서드들
  async register(registerDto: RegisterDto) {
    const { email, password, displayName } = registerDto;

    // 이미 존재하는 사용자인지 확인
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    // 비밀번호 해시
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 새 사용자 생성
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .insert({
        email,
        password_hash: hashedPassword,
        display_name: displayName || email.split("@")[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const profile = data as Profile;

    // JWT 토큰 생성
    const payload = {
      email: profile.email,
      sub: profile.id,
      displayName: profile.display_name,
    };

    return {
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
      },
      access_token: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const profile = user;

    const payload = {
      email: profile.email,
      sub: profile.id,
      displayName: profile.display_name,
    };

    return {
      user: {
        id: profile.id,
        email: profile.email,
        displayName: profile.display_name,
      },
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, password: string): Promise<Profile | null> {
    const user = await this.findUserByEmail(email);
    if (!user || !user.password_hash) {
      return null;
    }

    const profile = user;
    const isPasswordValid = await bcrypt.compare(
      password,
      profile.password_hash!
    );
    if (!isPasswordValid) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...result } = profile;
    return result as Profile;
  }

  private async findUserByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new Error(error.message);
    }

    return data as Profile | null;
  }
}
