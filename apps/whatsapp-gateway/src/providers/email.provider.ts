import type { ChannelProvider, GenericInboundMessage, GenericSendInput, SendMessageResult } from '@kentos/shared';

const PROVIDER_NAME_DEFAULT = 'smtp-email';

type EmailTransport = 'smtp' | 'postmark';

type SmtpAuth = { user: string; pass: string };
type SmtpTransporter = {
  sendMail(options: { from: string; to: string; subject: string; text: string }): Promise<{ messageId?: string }>;
};
type SmtpModule = {
  createTransport(options: { host: string; port: number; secure: boolean; auth?: SmtpAuth }): SmtpTransporter;
};

function readTransport(): EmailTransport {
  const value = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (value === 'postmark') return 'postmark';
  return 'smtp';
}

export class EmailProvider implements ChannelProvider {
  channel = 'EMAIL' as const;
  providerName = PROVIDER_NAME_DEFAULT;

  async parseWebhook(_raw: unknown): Promise<GenericInboundMessage[]> {
    return [];
  }

  async sendText(input: GenericSendInput): Promise<SendMessageResult> {
    if (process.env.EMAIL_OUTBOUND_LIVE !== 'true') {
      console.log(`[EMAIL] dry-run → ${input.to}: "${input.text.slice(0, 60)}"`);
      return {
        provider: this.providerName,
        externalMessageId: `email-dry-${Date.now()}`,
        sentAt: new Date().toISOString(),
      };
    }

    const transport = readTransport();
    const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim();
    if (!fromAddress) {
      throw new Error('EMAIL_FROM_ADDRESS yapilandirilmadi.');
    }

    if (transport === 'postmark') {
      return sendViaPostmark(this.providerName, fromAddress, input);
    }
    return sendViaSmtp(this.providerName, fromAddress, input);
  }
}

async function sendViaPostmark(providerName: string, fromAddress: string, input: GenericSendInput): Promise<SendMessageResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (!token) {
    throw new Error('POSTMARK_SERVER_TOKEN yapilandirilmadi.');
  }
  const subject = (process.env.EMAIL_DEFAULT_SUBJECT ?? 'Belediye Bilgilendirmesi').slice(0, 998);
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': token,
    },
    body: JSON.stringify({
      From: fromAddress,
      To: input.to,
      Subject: subject,
      TextBody: input.text,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? 'outbound',
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Postmark email send failed: ${response.status}${text ? ` ${text.slice(0, 200)}` : ''}`);
  }
  const payload = (await response.json().catch(() => ({}))) as { MessageID?: string };
  return {
    provider: providerName,
    externalMessageId: payload.MessageID ?? `email-${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}

async function sendViaSmtp(providerName: string, fromAddress: string, input: GenericSendInput): Promise<SendMessageResult> {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  if (!host || !portRaw) {
    throw new Error('SMTP_HOST/SMTP_PORT yapilandirilmadi.');
  }
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('SMTP_PORT gecersiz.');
  }

  let smtpModule: SmtpModule;
  try {
    smtpModule = (await import('nodemailer' as string)) as unknown as SmtpModule;
  } catch (error) {
    throw new Error(`SMTP transport icin nodemailer paketi yuklu degil: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  const transporter = smtpModule.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  const subject = (process.env.EMAIL_DEFAULT_SUBJECT ?? 'Belediye Bilgilendirmesi').slice(0, 998);
  const info = await transporter.sendMail({
    from: fromAddress,
    to: input.to,
    subject,
    text: input.text,
  });
  return {
    provider: providerName,
    externalMessageId: info.messageId ?? `email-${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}
