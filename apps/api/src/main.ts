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
import { mountBullBoard } from './common/bull-board.js';

async function bootstrap() {
  // Init Sentry before anything else so all errors are captured
  await initSentry(process.env.SENTRY_DSN, process.env.NODE_ENV ?? 'development');

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);

  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN')?.trim();
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('api/v1', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));

  // Attach a unique request ID to every incoming request and propagate to response
  app.use((req: { headers: Record<string, string | undefined> }, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

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

  // Bull Board queue monitoring — /admin/queues (HTTP Basic Auth via BULL_BOARD_USER/PASS)
  mountBullBoard(app.getHttpAdapter().getInstance() as Parameters<typeof mountBullBoard>[0]);

  const port = Number(config.get<string>('PORT') ?? 3100);
  await app.listen(port);
  logger.log(`KentOS API listening on http://localhost:${port}/api/v1`);
  logger.log(`KentOS API docs available on http://localhost:${port}/api/docs`);

  // Outbound kanal ve kritik özellik durumları
  const live = (flag: string | undefined) => flag === 'true' ? 'LIVE 🟢' : 'DRY-RUN 🟡';
  logger.log(`Outbound → WA:${live(process.env.WHATSAPP_OUTBOUND_LIVE)} EMAIL:${live(process.env.EMAIL_OUTBOUND_LIVE)} SMS:${live(process.env.SMS_OUTBOUND_LIVE)} IG:${live(process.env.INSTAGRAM_OUTBOUND_LIVE)} FB:${live(process.env.FACEBOOK_OUTBOUND_LIVE)}`);
  logger.log(`Retention: ${process.env.RETENTION_DRY_RUN === 'false' ? 'GERÇEK SİLME 🔴' : 'DRY-RUN 🟡'} | AI Budget: ${process.env.AI_DAILY_BUDGET_USD ?? 'sınırsız ⚠️'} | Sentry: ${process.env.SENTRY_DSN ? 'aktif 🟢' : 'kapalı 🔴'}`);
}

void bootstrap();
