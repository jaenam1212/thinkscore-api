import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3002",
      "https://thinkscore.vercel.app", // Vercel 도메인
      "https://thinkscore-git-main-your-username.vercel.app", // Vercel 프리뷰 도메인
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3001}`
  );
}

bootstrap().catch((err) => {
  console.error("Error starting application:", err);
  process.exit(1);
});
