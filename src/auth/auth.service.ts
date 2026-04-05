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
import { AppleService } from "./apple.service";

interface ProfileData {
  display_name?: string;
  email?: string;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  username?: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
  kakao_id?: string;
  google_id?: string;
  naver_id?: string;
  apple_id?: string;
  avatar_url?: string;
  provider?: string;
  last_login_at?: string;
}

interface KakaoProfile {
  id: string;
  nickname: string;
  email: string;
  profileImage: string;
}

interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface NaverProfile {
  id: string;
  nickname: string;
  email: string;
  profile_image: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly appleService: AppleService
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

  async getUser(userId: string): Promise<Profile> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  }

  async createOrUpdateProfile(
    userId: string,
    profileData: ProfileData
  ): Promise<Profile> {
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
    return data as Profile;
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
    const emailNorm = this.normalizeEmail(email);

    // 이미 존재하는 사용자인지 확인
    const existingUser = await this.findUserByEmail(emailNorm);
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
        email: emailNorm,
        password_hash: hashedPassword,
        display_name: displayName || emailNorm.split("@")[0],
        username: displayName || emailNorm.split("@")[0],
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** DB에 대소문자만 다른 이메일이 있어도 찾을 수 있게 조회 */
  private async findUserByEmail(email: string): Promise<Profile | null> {
    const normalized = this.normalizeEmail(email);
    if (!normalized) return null;

    const client = this.supabaseService.getClient();

    const { data: exact, error: e1 } = await client
      .from("profiles")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (e1) throw new Error(e1.message);
    if (exact) return exact as Profile;

    const { data: ciRows, error: e2 } = await client
      .from("profiles")
      .select("*")
      .ilike("email", normalized)
      .limit(5);

    if (e2) throw new Error(e2.message);
    if (!ciRows?.length) return null;

    const match = ciRows.find(
      (r) => this.normalizeEmail((r as Profile).email) === normalized
    );
    return (match as Profile) ?? (ciRows[0] as Profile);
  }

  private isUniqueViolation(error: {
    code?: string;
    message?: string;
  }): boolean {
    const msg = typeof error.message === "string" ? error.message : "";
    return (
      error.code === "23505" ||
      msg.includes("duplicate key") ||
      msg.includes("profiles_email_unique")
    );
  }

  private async linkGoogleToProfile(
    user: Profile,
    profile: GoogleProfile
  ): Promise<Profile> {
    const fromGoogle = profile.name?.trim();
    const patch: Record<string, string> = {
      google_id: profile.id,
      avatar_url: profile.picture,
      provider: "google",
      last_login_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!user.display_name?.trim() && fromGoogle) {
      patch.display_name = fromGoogle;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  }

  async kakaoLogin(accessToken: string, profile: KakaoProfile) {
    // 카카오 토큰 검증 (선택사항)
    // await this.verifyKakaoToken(accessToken);

    let user = await this.findUserByKakaoId(profile.id);

    if (!user) {
      user = await this.findUserByEmail(profile.email);

      if (user) {
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .update({
            kakao_id: profile.id,
            avatar_url: profile.profileImage,
            provider: "kakao",
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        user = data as Profile;
      } else {
        const emailK = this.normalizeEmail(profile.email);
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .insert({
            email: emailK,
            display_name: profile.nickname,
            username: profile.nickname,
            kakao_id: profile.id,
            avatar_url: profile.profileImage,
            provider: "kakao",
            last_login_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (this.isUniqueViolation(error)) {
            const existing = await this.findUserByEmail(emailK);
            if (existing) {
              const { data: u, error: e2 } = await this.supabaseService
                .getClient()
                .from("profiles")
                .update({
                  kakao_id: profile.id,
                  avatar_url: profile.profileImage,
                  provider: "kakao",
                  last_login_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id)
                .select()
                .single();
              if (e2) throw new Error(e2.message);
              user = u as Profile;
            } else {
              throw new Error(error.message);
            }
          } else {
            throw new Error(error.message);
          }
        } else {
          user = data as Profile;
        }
      }
    } else {
      await this.updateLastLogin(user.id);
    }

    return this.generateJWTResponse(user);
  }

  private async findUserByKakaoId(kakaoId: string): Promise<Profile | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("kakao_id", kakaoId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as Profile | null;
  }

  async googleLogin(accessToken: string, profile: GoogleProfile) {
    if (!profile.email) {
      throw new Error("Google 계정에서 이메일 정보를 가져올 수 없습니다.");
    }

    const email = this.normalizeEmail(profile.email);
    if (!email) {
      throw new Error("Google 계정에서 이메일 정보를 가져올 수 없습니다.");
    }

    const displayName = profile.name?.trim() || email.split("@")[0];
    const username = `google_${profile.id}`.slice(0, 100);

    let user = await this.findUserByGoogleId(profile.id);

    if (!user) {
      user = await this.findUserByEmail(email);

      if (user) {
        user = await this.linkGoogleToProfile(user, profile);
      } else {
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .insert({
            email,
            display_name: displayName,
            username,
            google_id: profile.id,
            avatar_url: profile.picture,
            provider: "google",
            last_login_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (this.isUniqueViolation(error)) {
            const existing = await this.findUserByEmail(email);
            if (existing) {
              user = await this.linkGoogleToProfile(existing, profile);
            } else {
              throw new Error(error.message);
            }
          } else {
            throw new Error(error.message);
          }
        } else {
          user = data as Profile;
        }
      }
    } else {
      await this.updateLastLogin(user.id);
      const fromGoogle = profile.name?.trim();
      if (!user.display_name?.trim() && fromGoogle) {
        const { data } = await this.supabaseService
          .getClient()
          .from("profiles")
          .update({
            display_name: fromGoogle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();
        if (data) {
          user = data as Profile;
        }
      }
    }

    return this.generateJWTResponse(user);
  }

  async naverLogin(accessToken: string, profile: NaverProfile) {
    let user = await this.findUserByNaverId(profile.id);

    if (!user) {
      user = await this.findUserByEmail(profile.email);

      if (user) {
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .update({
            naver_id: profile.id,
            avatar_url: profile.profile_image,
            provider: "naver",
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        user = data as Profile;
      } else {
        const emailN = this.normalizeEmail(profile.email);
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .insert({
            email: emailN,
            display_name: profile.nickname,
            username: profile.nickname,
            naver_id: profile.id,
            avatar_url: profile.profile_image,
            provider: "naver",
            last_login_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (this.isUniqueViolation(error)) {
            const existing = await this.findUserByEmail(emailN);
            if (existing) {
              const { data: u, error: e2 } = await this.supabaseService
                .getClient()
                .from("profiles")
                .update({
                  naver_id: profile.id,
                  avatar_url: profile.profile_image,
                  provider: "naver",
                  last_login_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id)
                .select()
                .single();
              if (e2) throw new Error(e2.message);
              user = u as Profile;
            } else {
              throw new Error(error.message);
            }
          } else {
            throw new Error(error.message);
          }
        } else {
          user = data as Profile;
        }
      }
    } else {
      await this.updateLastLogin(user.id);
    }

    return this.generateJWTResponse(user);
  }

  async appleLogin(
    idToken: string,
    userData?: {
      name?: { firstName?: string; lastName?: string };
      email?: string;
    }
  ) {
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("Apple Client ID not configured");
    }

    const tokenData = await this.appleService.verifyIdToken(idToken, clientId);

    let user = await this.findUserByAppleId(tokenData.sub);
    const emailRaw = userData?.email || tokenData.email;

    if (!emailRaw) {
      throw new Error("Email is required for Apple login");
    }

    const email = this.normalizeEmail(emailRaw);

    if (!user) {
      user = await this.findUserByEmail(email);

      if (user) {
        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .update({
            apple_id: tokenData.sub,
            provider: "apple",
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        user = data as Profile;
      } else {
        const displayName = userData?.name
          ? `${userData.name.firstName || ""} ${userData.name.lastName || ""}`.trim()
          : email.split("@")[0];
        const username = `apple_${tokenData.sub}`.slice(0, 100);

        const { data, error } = await this.supabaseService
          .getClient()
          .from("profiles")
          .insert({
            email,
            display_name: displayName,
            username,
            apple_id: tokenData.sub,
            provider: "apple",
            last_login_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (this.isUniqueViolation(error)) {
            const existing = await this.findUserByEmail(email);
            if (existing) {
              const { data: u, error: e2 } = await this.supabaseService
                .getClient()
                .from("profiles")
                .update({
                  apple_id: tokenData.sub,
                  provider: "apple",
                  last_login_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id)
                .select()
                .single();
              if (e2) throw new Error(e2.message);
              user = u as Profile;
            } else {
              throw new Error(error.message);
            }
          } else {
            throw new Error(error.message);
          }
        } else {
          user = data as Profile;
        }
      }
    } else {
      await this.updateLastLogin(user.id);
    }

    return this.generateJWTResponse(user);
  }

  private async findUserByGoogleId(googleId: string): Promise<Profile | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("google_id", googleId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as Profile | null;
  }

  private async findUserByNaverId(naverId: string): Promise<Profile | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("naver_id", naverId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as Profile | null;
  }

  private async findUserByAppleId(appleId: string): Promise<Profile | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("*")
      .eq("apple_id", appleId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as Profile | null;
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await this.supabaseService
      .getClient()
      .from("profiles")
      .update({
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

  private generateJWTResponse(user: Profile) {
    const payload = {
      email: user.email,
      sub: user.id,
      displayName: user.display_name,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      access_token: this.jwtService.sign(payload),
    };
  }
}
