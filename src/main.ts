import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

async function bootstrap() {
  const port = parseInt(process.env.PORT || "3001", 10);
  console.log("[Startup] PORT:", port, "PORT env:", process.env.PORT);

  const app = await NestFactory.create(AppModule);

  // Security headers (crossOriginEmbedderPolicy 비활성화 - CORS 요청 허용)
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // DTO에 없는 속성이 있으면 에러
      transform: true, // 자동 타입 변환
      disableErrorMessages: false, // 에러 메시지 활성화
    })
  );

  // CORS 설정
  const originsEnv = process.env.CORS_ORIGINS || "";
  const parsedOrigins = originsEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultOrigins = [
    "http://localhost:3000",
    "https://thinkscore.vercel.app",
    "https://thinkscore-eight.vercel.app",
    "https://thinkscore.kr",
    "https://www.thinkscore.kr",
  ];
  const origins = parsedOrigins.length > 0 ? parsedOrigins : defaultOrigins;

  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Origin", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  });

  await app.listen(port, "0.0.0.0");
  console.log(`[Startup] Application is running on 0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error("Error starting application:", err);
  process.exit(1);
});
