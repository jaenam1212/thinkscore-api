import { Controller, Get, Post, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
      // Supabase Auth callback 처리
      const { access_token } = req.query;

      if (access_token && typeof access_token === "string") {
        // 토큰을 쿠키에 저장하거나 프론트엔드로 리다이렉트
        res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}?access_token=${access_token}`
        );
      } else {
        res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/error`
        );
      }
    } catch {
      res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/error`
      );
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
  async getUser() {
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
}
