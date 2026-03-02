import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Railway 헬스체크용 - DB 등 의존성 없이 빠르게 응답 */
  @Get("health")
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
