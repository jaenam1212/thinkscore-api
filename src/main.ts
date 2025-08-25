import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
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
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin"],
    credentials: true,
  });

  const port = parseInt(process.env.PORT || "3001", 10);
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error("Error starting application:", err);
  process.exit(1);
});
