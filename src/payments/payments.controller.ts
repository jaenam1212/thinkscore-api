import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import type { RevenueCatWebhookPayload } from "./payments.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

interface PurchaseVerifyDto {
  productId: string;
}

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
   * 사용자 구독 상태 조회
   * 앱 시작 시 RevenueCat에서 최신 상태 동기화 후 반환
   */
  @UseGuards(JwtAuthGuard)
  @Get("subscription/:userId")
  async getSubscription(@Param("userId") userId: string) {
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
    @Body() body: PurchaseVerifyDto
  ) {
    return this.paymentsService.verifyPurchase(userId, body.productId);
  }
}
