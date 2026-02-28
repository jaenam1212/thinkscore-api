import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { SupabaseService } from "../../supabase/supabase.service";

interface RequestWithUser {
  user?: { userId?: string; id?: string };
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const userId = user?.userId ?? user?.id;

    if (!userId) {
      throw new ForbiddenException("인증이 필요합니다.");
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (error || !data?.is_admin) {
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    return true;
  }
}
