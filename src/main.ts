import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "https://thinkscore.vercel.app", // Vercel 도메인
      "https://thinkscore-eight.vercel.app", // Vercel 프리뷰 도메인
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  });

  const port = parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error("Error starting application:", err);
  process.exit(1);
});
