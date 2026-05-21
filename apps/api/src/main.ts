import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { initSentry } from './common/sentry.js';

async function bootstrap() {
  // Init Sentry before anything else so all errors are captured
  await initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV ?? 'development');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.use(helmet());

  // Attach a unique request ID to every incoming request
  app.use((req: { headers: Record<string, string | undefined> }, _res: unknown, next: () => void) => {
    req.headers['x-request-id'] ??= randomUUID();
    next();
  });

  const corsOrigin = config.get<string>('CORS_ORIGIN')?.trim();
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  if (isProduction && !corsOrigin) {
    throw new Error('CORS_ORIGIN env var is required in production. Set it to a comma-separated list of allowed origins.');
  }
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

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
  logger.log(`KentOS API listening on http://localhost:${port}/api/v1`);
  logger.log(`KentOS API docs available on http://localhost:${port}/api/docs`);
}

void bootstrap();
