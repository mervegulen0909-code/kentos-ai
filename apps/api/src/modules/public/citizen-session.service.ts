import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CitizenSessionPayload = {
  citizenId: string;
  tenantId: string;
  tenantSlug: string;
  exp: number;
};

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class CitizenSessionService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  issue(input: Omit<CitizenSessionPayload, 'exp'>): string {
    const payload: CitizenSessionPayload = {
      ...input,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  verify(token: unknown, tenantSlug: string): CitizenSessionPayload {
    if (typeof token !== 'string') {
      throw new UnauthorizedException('Citizen oturumu gecersiz.');
    }
    const [encodedPayload, signature, remainder] = token.split('.');
    if (!encodedPayload || !signature || remainder) {
      throw new UnauthorizedException('Citizen oturumu gecersiz.');
    }

    const received = Buffer.from(signature);
    const expected = Buffer.from(this.sign(encodedPayload));
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Citizen oturumu gecersiz.');
    }

    let payload: CitizenSessionPayload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CitizenSessionPayload;
    } catch {
      throw new UnauthorizedException('Citizen oturumu gecersiz.');
    }

    if (
      typeof payload.citizenId !== 'string'
      || typeof payload.tenantId !== 'string'
      || payload.tenantSlug !== tenantSlug
      || typeof payload.exp !== 'number'
      || payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Citizen oturumu gecersiz veya suresi dolmus.');
    }

    return payload;
  }

  private sign(encodedPayload: string): string {
    const secret = this.config.getOrThrow<string>('CITIZEN_SESSION_SECRET');
    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  }
}
