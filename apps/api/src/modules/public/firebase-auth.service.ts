import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export type FirebaseDecodedToken = {
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
  picture?: string;
};

/**
 * Firebase Admin SDK üzerinden ID token doğrulama.
 *
 * Yapılandırma (birini seç):
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 — base64 kodlanmış service account JSON
 *   GOOGLE_APPLICATION_CREDENTIALS  — service account JSON dosya yolu
 *   (ikisi de yoksa uygulama varsayılan kimlik bilgileri denenir)
 *
 * FIREBASE_PROJECT_ID yoksa servis devre dışı kalır ve her doğrulama 401 fırlatır.
 */
@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private readonly app: App | null = null;

  constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID tanımlı değil — Firebase Auth devre dışı.');
      return;
    }

    if (getApps().length > 0) {
      this.app = getApps()[0]!;
      return;
    }

    try {
      const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
      const credential = b64
        ? cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')))
        : applicationDefault();

      this.app = initializeApp({ credential, projectId });
      this.logger.log(`Firebase Admin başlatıldı (project: ${projectId})`);
    } catch (err) {
      this.logger.error(`Firebase Admin başlatma hatası: ${String(err)}`);
    }
  }

  async verifyIdToken(idToken: string): Promise<FirebaseDecodedToken> {
    if (!this.app) throw new UnauthorizedException('Firebase Auth yapılandırılmamış.');

    try {
      const decoded = await getAuth(this.app).verifyIdToken(idToken, true);
      return {
        uid: decoded.uid,
        email: decoded.email,
        phone: decoded.phone_number,
        name: decoded.name,
        picture: decoded.picture,
      };
    } catch {
      throw new UnauthorizedException('Firebase ID token geçersiz veya süresi dolmuş.');
    }
  }
}
