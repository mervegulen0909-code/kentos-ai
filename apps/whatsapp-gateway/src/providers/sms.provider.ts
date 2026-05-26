import type { ChannelProvider, GenericInboundMessage, GenericSendInput, SendMessageResult } from '@kentos/shared';
import { logger } from '../logger.js';

type TwilioInboundForm = {
  AccountSid?: string;
  MessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  SmsStatus?: string;
};

const TENANT_ENV_FALLBACK = 'SMS_DEFAULT_TENANT_ID';

export class TwilioSmsProvider implements ChannelProvider {
  channel = 'SMS' as const;
  providerName = 'twilio-sms';

  async parseWebhook(raw: unknown): Promise<GenericInboundMessage[]> {
    const payload = raw as TwilioInboundForm | undefined;
    if (!payload?.MessageSid || !payload.From || !payload.Body) return [];
    const tenantId = process.env[TENANT_ENV_FALLBACK];
    if (!tenantId) return [];

    return [
      {
        tenantId,
        channel: 'SMS',
        provider: this.providerName,
        externalConversationId: `sms:${payload.From}`,
        externalMessageId: payload.MessageSid,
        from: payload.From,
        text: payload.Body.trim(),
        receivedAt: new Date().toISOString(),
      },
    ];
  }

  async sendText(input: GenericSendInput): Promise<SendMessageResult> {
    if (process.env.SMS_OUTBOUND_LIVE !== 'true') {
      logger.info('[SMS] dry-run', { to: input.to, textPreview: input.text.slice(0, 60) });
      return {
        provider: this.providerName,
        externalMessageId: `sms-dry-${Date.now()}`,
        sentAt: new Date().toISOString(),
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio SMS credentials (SID/AUTH/FROM) yapilandirilmadi.');
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      From: fromNumber,
      To: input.to,
      Body: input.text,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`SMS send failed: ${response.status}`);
    const payload = (await response.json().catch(() => ({}))) as { sid?: string };
    return {
      provider: this.providerName,
      externalMessageId: payload.sid ?? `sms-${Date.now()}`,
      sentAt: new Date().toISOString(),
    };
  }
}
