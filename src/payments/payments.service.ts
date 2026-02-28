import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";

// RevenueCat 웹훅 이벤트 타입
export type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "NON_RENEWING_PURCHASE"
  | "SUBSCRIPTION_PAUSED"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "TRANSFER";

export interface RevenueCatWebhookPayload {
  api_version: string;
  event: {
    aliases: string[];
    app_id: string;
    app_user_id: string; // 우리 앱의 user_id
    commission_percentage: number | null;
    country_code: string;
    currency: string;
    entitlement_id: string | null;
    entitlement_ids: string[];
    environment: "SANDBOX" | "PRODUCTION";
    expiration_at_ms: number | null;
    id: string;
    is_family_share: boolean;
    offer_code: string | null;
    original_app_user_id: string;
    period_type: "NORMAL" | "TRIAL" | "INTRO";
    presented_offering_id: string | null;
    price: number;
    price_in_purchased_currency: number;
    product_id: string;
    purchased_at_ms: number;
    store: "APP_STORE" | "PLAY_STORE" | "PROMOTIONAL" | "STRIPE";
    subscriber_attributes: Record<
      string,
      { value: string; updated_at_ms: number }
    >;
    transaction_id: string;
    type: RevenueCatEventType;
  };
}

export interface SubscriptionStatus {
  user_id: string;
  is_premium: boolean;
  plan_id: string | null;
  expires_at: string | null;
  store: string | null;
  environment: string | null;
  updated_at: string;
}

/** RevenueCat REST API 응답 구조 */
interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string }>;
    subscriptions?: Record<
      string,
      { expires_date?: string; store?: string; is_sandbox?: boolean }
    >;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly revenueCatApiKey: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService
  ) {
    this.revenueCatApiKey =
      this.configService.get<string>("REVENUECAT_API_KEY") || "";
    this.webhookSecret =
      this.configService.get<string>("REVENUECAT_WEBHOOK_SECRET") || "";
  }

  /**
   * RevenueCat 웹훅 서명 검증
   * RevenueCat은 Authorization 헤더로 웹훅 시크릿을 전송함
   */
  verifyWebhookSignature(authorizationHeader: string | undefined): void {
    if (!this.webhookSecret) {
      this.logger.warn(
        "REVENUECAT_WEBHOOK_SECRET not set, skipping verification"
      );
      return;
    }
    if (authorizationHeader !== this.webhookSecret) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
  }

  /**
   * RevenueCat 웹훅 이벤트 처리
   */
  async handleWebhookEvent(payload: RevenueCatWebhookPayload): Promise<void> {
    const { event } = payload;
    const userId = event.app_user_id;

    this.logger.log(
      `Webhook event: ${event.type} for user ${userId}, product: ${event.product_id}, env: ${event.environment}`
    );

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "NON_RENEWING_PURCHASE":
        await this.activateSubscription(userId, event);
        break;

      case "CANCELLATION":
      case "EXPIRATION":
        await this.deactivateSubscription(userId, event);
        break;

      case "BILLING_ISSUE":
        // 결제 실패 — 유예기간 중이므로 즉시 비활성화하지 않음 (RevenueCat이 grace period 관리)
        this.logger.warn(`Billing issue for user ${userId}`);
        break;

      case "SUBSCRIPTION_PAUSED":
        await this.pauseSubscription(userId, event);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async activateSubscription(
    userId: string,
    event: RevenueCatWebhookPayload["event"]
  ): Promise<void> {
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

    const { error } = await this.supabaseService
      .getClient()
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          is_premium: true,
          plan_id: event.product_id,
          store: event.store,
          environment: event.environment,
          transaction_id: event.transaction_id,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      this.logger.error(
        `Failed to activate subscription for ${userId}:`,
        error
      );
      throw error;
    }

    this.logger.log(
      `Subscription activated for user ${userId}, expires: ${expiresAt}`
    );
  }

  private async deactivateSubscription(
    userId: string,
    event: RevenueCatWebhookPayload["event"]
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          is_premium: false,
          plan_id: event.product_id,
          store: event.store,
          environment: event.environment,
          transaction_id: event.transaction_id,
          expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      this.logger.error(
        `Failed to deactivate subscription for ${userId}:`,
        error
      );
      throw error;
    }

    this.logger.log(`Subscription deactivated for user ${userId}`);
  }

  private async pauseSubscription(
    userId: string,
    event: RevenueCatWebhookPayload["event"]
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          is_premium: false,
          plan_id: event.product_id,
          store: event.store,
          environment: event.environment,
          transaction_id: event.transaction_id,
          expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      this.logger.error(`Failed to pause subscription for ${userId}:`, error);
    }
  }

  /**
   * 사용자 구독 상태 조회
   */
  async getSubscriptionStatus(
    userId: string
  ): Promise<SubscriptionStatus | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to get subscription for ${userId}:`, error);
      return null;
    }

    if (!data) return null;

    const row = data as { expires_at?: string } & SubscriptionStatus;
    // 만료 시간 체크 (DB에 저장된 expires_at이 지났으면 비활성화)
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { ...row, is_premium: false };
    }

    return row as SubscriptionStatus;
  }

  /**
   * RevenueCat REST API로 구독자 정보 직접 조회 (앱 시작 시 동기화용)
   */
  async syncSubscriberFromRevenueCat(
    userId: string
  ): Promise<SubscriptionStatus | null> {
    if (!this.revenueCatApiKey) {
      this.logger.warn("REVENUECAT_API_KEY not set, skipping sync");
      return this.getSubscriptionStatus(userId);
    }

    try {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.revenueCatApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        this.logger.error(`RevenueCat API error: ${response.status}`);
        return this.getSubscriptionStatus(userId);
      }

      const data = (await response.json()) as RevenueCatSubscriberResponse;
      const subscriber = data.subscriber;

      // 활성 entitlement 확인
      const entitlements: Record<string, { expires_date?: string }> =
        subscriber?.entitlements ?? {};
      const premiumEntitlement = entitlements["premium"]; // 대시보드에서 설정한 entitlement ID

      const isPremium =
        premiumEntitlement &&
        (!premiumEntitlement.expires_date ||
          new Date(premiumEntitlement.expires_date) > new Date());

      // 활성 구독 정보 추출
      const subscriptions: Record<
        string,
        { expires_date?: string; store?: string; is_sandbox?: boolean }
      > = subscriber?.subscriptions ?? {};
      const activeSubKey = Object.keys(subscriptions).find(
        (key) =>
          subscriptions[key].expires_date &&
          new Date(subscriptions[key].expires_date) > new Date()
      );
      const activeSub = activeSubKey ? subscriptions[activeSubKey] : null;

      // DB 동기화
      const status: Omit<SubscriptionStatus, "updated_at"> = {
        user_id: userId,
        is_premium: isPremium || false,
        plan_id: activeSubKey || null,
        expires_at:
          activeSub?.expires_date ?? premiumEntitlement?.expires_date ?? null,
        store: activeSub?.store ?? null,
        environment: activeSub?.is_sandbox ? "SANDBOX" : "PRODUCTION",
      };

      const { error } = await this.supabaseService
        .getClient()
        .from("subscriptions")
        .upsert(
          { ...status, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (error) {
        this.logger.error("Failed to sync subscription to DB:", error);
      }

      return { ...status, updated_at: new Date().toISOString() };
    } catch (err) {
      this.logger.error("RevenueCat sync failed:", err);
      return this.getSubscriptionStatus(userId);
    }
  }

  /**
   * 클라이언트에서 올라온 구매 영수증 검증 (선택적 - RevenueCat SDK가 자동 처리하지만 추가 검증용)
   */
  async verifyPurchase(
    userId: string,
    productId: string
  ): Promise<{ verified: boolean; isPremium: boolean }> {
    if (!productId) {
      throw new BadRequestException("productId is required");
    }

    // RevenueCat에서 현재 상태 동기화 후 반환
    const status = await this.syncSubscriberFromRevenueCat(userId);
    return {
      verified: true,
      isPremium: status?.is_premium || false,
    };
  }
}
