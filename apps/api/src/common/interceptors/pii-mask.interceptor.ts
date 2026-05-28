import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Turkish National ID: 11 digits, starts with 1-9
const TC_KIMLIK_RE = /\b([1-9][0-9]{10})\b/g;

function maskValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(TC_KIMLIK_RE, (match) => `${match.slice(0, 3)}****${match.slice(-1)}`);
  }
  if (Array.isArray(value)) return value.map(maskValue);
  if (value && typeof value === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      masked[k] = maskValue(v);
    }
    return masked;
  }
  return value;
}

/**
 * KVKK Madde 6 — TC Kimlik No maskeleme.
 * Outbound JSON içindeki 11 haneli TC kimlik numaralarını maskeler: 123****4
 * Env değişkeni PII_MASK_ENABLED=false ile devre dışı bırakılabilir.
 */
@Injectable()
export class PiiMaskInterceptor implements NestInterceptor {
  private readonly enabled = process.env.PII_MASK_ENABLED !== 'false';

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();
    return next.handle().pipe(map((data) => maskValue(data)));
  }
}
