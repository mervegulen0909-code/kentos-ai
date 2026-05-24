import { Injectable, Logger } from '@nestjs/common';

type FcmPushPayload = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * FCM HTTP v1 API üzerinden push bildirimi gönderir.
 *
 * Yapılandırma:
 *   FCM_PROJECT_ID  — Firebase proje ID'si
 *   FCM_SERVER_KEY  — Firebase Cloud Messaging sunucu anahtarı (Legacy API, Simple auth)
 *
 * Her iki env değişkeni de tanımlı değilse servis sessizce devre dışı kalır.
 * Bildirim gönderme hataları asla ana işlemi engellemez.
 */
@Injectable()
export class FcmPushService {
  private readonly logger = new Logger(FcmPushService.name);

  async send(payload: FcmPushPayload): Promise<void> {
    const serverKey = process.env.FCM_SERVER_KEY?.trim();
    if (!serverKey) return; // FCM configured edilmemiş → sessizce atla

    try {
      const body = JSON.stringify({
        to: payload.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`FCM send failed HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      this.logger.warn(`FCM send error: ${String(err)}`);
    }
  }

  async sendToMany(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!tokens.length) return;
    await Promise.allSettled(tokens.map((token) => this.send({ token, title, body, data })));
  }
}
