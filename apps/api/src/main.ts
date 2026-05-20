import 'reflect-metadata';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.use(helmet());

  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  if (isProduction && !corsOrigin) {
    throw new Error('CORS_ORIGIN env var is required in production. Set it to a comma-separated list of allowed origins.');
  }
  app.enableCors({ origin: corsOrigin?.split(',') ?? true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('KentOS AI API')
    .setDescription('Municipal citizen request, workflow, SLA and channel operations API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(config.get<string>('PORT') ?? 3100);
  await app.listen(port);
  console.log(`KentOS API listening on http://localhost:${port}/api/v1`);
  console.log(`KentOS API docs available on http://localhost:${port}/api/docs`);
}

void bootstrap();
