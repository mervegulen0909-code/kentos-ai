import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    const token = process.env.POSTMARK_SERVER_TOKEN ?? '';
    const fromAddress = process.env.MAIL_FROM_ADDRESS ?? '';
    const fromName = process.env.MAIL_FROM_NAME ?? 'KentOS';
    const baseUrl = process.env.ADMIN_WEB_URL ?? 'http://localhost:3111';

    if (!token || !fromAddress) {
      this.logger.warn(`POSTMARK_SERVER_TOKEN or MAIL_FROM_ADDRESS not set — skipping password reset email to ${to}`);
      return;
    }

    const link = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
    const from = `${fromName} <${fromAddress}>`;

    const body = {
      From: from,
      To: to,
      Subject: 'Şifre Sıfırlama Talebi',
      TextBody: [
        'Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın (1 saat geçerli):',
        '',
        link,
        '',
        'Bu talebi siz yapmadıysanız güvende olduğunuzdan emin olmak için bizi bilgilendirin.',
      ].join('\n'),
      HtmlBody: [
        '<p>Şifrenizi sıfırlamak için <a href="' + link + '">buraya tıklayın</a> (1 saat geçerli).</p>',
        '<p>Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>',
      ].join(''),
      MessageStream: 'outbound',
    };

    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Postmark send failed (${res.status}): ${text}`);
    } else {
      this.logger.log(`Password reset email sent to ${to}`);
    }
  }
}
