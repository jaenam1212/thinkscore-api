import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";
import type { RevenueCatWebhookPayload } from "./payments.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

interface PurchaseVerifyDto {
  productId: string;
}

type AuthedRequest = Request & { user: { userId: string } };

@Controller("payments")
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * RevenueCat 웹훅 수신 엔드포인트
   * RevenueCat 대시보드에서 https://api.thinkscore.kr/payments/webhook 으로 설정
   * Authorization 헤더에 웹훅 시크릿 포함
   */
  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers("authorization") authorization: string,
    @Body() payload: RevenueCatWebhookPayload
  ) {
    // 서명 검증
    this.paymentsService.verifyWebhookSignature(authorization);

    this.logger.log(`Received webhook: ${payload?.event?.type}`);

    await this.paymentsService.handleWebhookEvent(payload);

    return { received: true };
  }

  /**
   * 로그인 사용자 본인 구독 (DB 기준, 웹 광고 제거·프리미엄 UI용)
   * 토스페이먼츠 웹훅으로 갱신된 subscriptions 행을 그대로 반영
   */
  @UseGuards(JwtAuthGuard)
  @Get("subscription/me")
  async getMySubscription(@Req() req: AuthedRequest) {
    return this.paymentsService.getSubscriptionStatus(req.user.userId);
  }

  /**
   * 사용자 구독 상태 조회 + RevenueCat 동기화 (스토어 인앱)
   * JWT sub와 :userId가 일치할 때만 허용
   */
  @UseGuards(JwtAuthGuard)
  @Get("subscription/:userId")
  async getSubscription(
    @Param("userId") userId: string,
    @Req() req: AuthedRequest
  ) {
    if (req.user.userId !== userId) {
      throw new ForbiddenException();
    }
    return this.paymentsService.syncSubscriberFromRevenueCat(userId);
  }

  /**
   * 구매 완료 후 서버 검증 (선택적)
   * RevenueCat SDK가 자동으로 처리하지만, 추가 보안을 위해 호출
   */
  @UseGuards(JwtAuthGuard)
  @Post("verify/:userId")
  async verifyPurchase(
    @Param("userId") userId: string,
    @Body() body: PurchaseVerifyDto,
    @Req() req: AuthedRequest
  ) {
    if (req.user.userId !== userId) {
      throw new ForbiddenException();
    }
    return this.paymentsService.verifyPurchase(userId, body.productId);
  }
}
