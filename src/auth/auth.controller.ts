import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthMigrationService } from "./auth-migration.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Profile } from "../common/types";

import { JwtAuthGuard } from "./guards/jwt-auth.guard";

interface JwtRequest extends Request {
  user: {
    userId: string;
    email: string;
    displayName: string;
  };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authMigrationService: AuthMigrationService
  ) {}

  @Get("signin/:provider")
  async signInWithProvider(
    @Param("provider") provider: string,
    @Res() res: Response
  ) {
    try {
      const { url } = await this.authService.signInWithProvider(provider);
      res.redirect(url);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  @Get("callback")
  handleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const { access_token } = req.query;
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

      if (access_token && typeof access_token === "string") {
        // 토큰을 URL에 노출하지 않고 postMessage로 안전하게 전달
        const html = `<!DOCTYPE html>
<html><head><script>
  window.opener?.postMessage({ type: 'AUTH_CALLBACK', token: '${access_token}' }, '${frontendUrl}');
  window.close();
  setTimeout(function() { window.location.href = '${frontendUrl}'; }, 300);
</script></head>
<body>로그인 처리 중...</body></html>`;
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } else {
        res.redirect(`${frontendUrl}/auth/error`);
      }
    } catch {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/error`);
    }
  }

  @Post("signout")
  async signOut(@Res() res: Response) {
    try {
      await this.authService.signOut();
      res.json({ message: "Signed out successfully" });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  @Get("user")
  async getUser(): Promise<Profile> {
    try {
      const session = await this.authService.getSession();
      if (!session.session) {
        throw new Error("No active session");
      }

      const user = await this.authService.getUser(session.session.user.id);
      return user;
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  // JWT 기반 회원가입/로그인 엔드포인트들
  @Post("register")
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Post("login")
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@Req() req: JwtRequest) {
    return {
      id: req.user.userId,
      email: req.user.email,
      displayName: req.user.displayName,
    };
  }

  @Post("kakao")
  async kakaoLogin(
    @Body() body: { accessToken: string; profile: KakaoProfile }
  ) {
    return this.authService.kakaoLogin(body.accessToken, body.profile);
  }

  @Post("naver")
  async naverLogin(
    @Body() body: { accessToken: string; profile: NaverProfile }
  ) {
    return this.authService.naverLogin(body.accessToken, body.profile);
  }

  @Post("google")
  async googleLogin(
    @Body() body: { accessToken: string; profile: GoogleProfile }
  ) {
    try {
      return await this.authService.googleLogin(body.accessToken, body.profile);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Google 로그인에 실패했습니다.";
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post("apple")
  async appleLogin(@Body() body: { idToken: string; user?: AppleUserData }) {
    return this.authService.appleLogin(body.idToken, body.user);
  }

  @Post("migrate-social")
  async migrateSocialLogin() {
    return this.authMigrationService.addSocialLoginFields();
  }
}

interface AppleUserData {
  name?: {
    firstName?: string;
    lastName?: string;
  };
  email?: string;
}

interface KakaoProfile {
  id: string;
  nickname: string;
  email: string;
  profileImage: string;
}

interface NaverProfile {
  id: string;
  nickname: string;
  email: string;
  profile_image: string;
}

interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
}
