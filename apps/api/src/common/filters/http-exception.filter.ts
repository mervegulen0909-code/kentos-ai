import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { captureException } from '../sentry.js';

type HttpRequest = { url: string; method: string; headers: Record<string, string | string[] | undefined> };
type HttpResponse = { status(code: number): HttpResponse; json(body: unknown): void };

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const request = ctx.getRequest<HttpRequest>();

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Beklenmeyen bir sunucu hatası oluştu.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message: string | string[] }).message;
      }
    } else {
      // Log unhandled errors with full detail server-side, never send to client
      this.logger.error('Unhandled exception', {
        requestId,
        path: request.url,
        method: request.method,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
      captureException(exception, { requestId, path: request.url });
    }

    response.status(status).json({
      statusCode: status,
      message,
      requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
