import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageVisibility } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';

type TicketWithContext = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  addressText: string | null;
  category: { name: string } | null;
  department: { name: string } | null;
  messages: Array<{ body: string; createdAt: Date; senderType: string }>;
};

type SuggestReplyResult = {
  suggestion: string;
  model: string;
  tokensUsed: number | null;
};

@Injectable()
export class TicketAiService {
  private readonly logger = new Logger(TicketAiService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async suggestReply(
    tenantId: string,
    ticketId: string,
    operatorNote?: string,
  ): Promise<SuggestReplyResult> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        messages: {
          where: { visibility: MessageVisibility.PUBLIC },
          orderBy: { createdAt: 'asc' },
          take: 10,
          select: { body: true, createdAt: true, senderType: true },
        },
        category: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Talep bulunamadi.');

    const config = this.readAnthropicConfig();
    if (!config.enabled) {
      return this.buildDeterministicSuggestion(ticket);
    }

    try {
      return await this.callAnthropic(ticket, config, operatorNote);
    } catch (err) {
      this.logger.warn(`AI suggest-reply failed, using deterministic: ${String(err)}`);
      return this.buildDeterministicSuggestion(ticket);
    }
  }

  private async callAnthropic(
    ticket: TicketWithContext,
    config: ReturnType<TicketAiService['readAnthropicConfig']>,
    operatorNote?: string,
  ): Promise<SuggestReplyResult> {
    const body = JSON.stringify({
      model: config.model,
      max_tokens: 600,
      temperature: 0.3,
      system: [
        {
          type: 'text',
          text: [
            'Sen bir Türk belediyesi için çalışan deneyimli bir müşteri hizmetleri uzmanısın.',
            'Görüşme geçmişine ve talep bilgilerine göre vatandaşa kibar, açık ve çözüm odaklı Türkçe bir yanıt oluştur.',
            'Yanıt 2-4 paragraf uzunluğunda olmalı. İnsan gibi, samimi ama profesyonel bir dil kullan.',
            'Sadece yanıt metnini döndür; JSON, başlık veya ek biçimlendirme kullanma.',
          ].join(' '),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: this.buildUserPrompt(ticket, operatorNote),
        },
      ],
    });

    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': config.version,
      },
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Anthropic HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    const suggestion = payload.content?.find((p) => p.type === 'text')?.text;
    if (!suggestion) throw new Error('No text content in Anthropic response');

    const tokensUsed =
      (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0) || null;

    return {
      suggestion: suggestion.trim(),
      model: payload.model ?? config.model,
      tokensUsed,
    };
  }

  private buildUserPrompt(ticket: TicketWithContext, operatorNote?: string): string {
    const lines: string[] = [
      `Talep başlığı: ${ticket.title}`,
      `Açıklama: ${ticket.description}`,
      `Durum: ${ticket.status}`,
      `Öncelik: ${ticket.priority}`,
    ];
    if (ticket.department) lines.push(`Birim: ${ticket.department.name}`);
    if (ticket.category) lines.push(`Kategori: ${ticket.category.name}`);
    if (ticket.addressText) lines.push(`Adres: ${ticket.addressText}`);

    if (ticket.messages.length > 0) {
      lines.push('\nGörüşme geçmişi:');
      for (const msg of ticket.messages) {
        const sender = msg.senderType === 'CITIZEN' ? 'Vatandaş' : 'Belediye';
        lines.push(`${sender}: ${msg.body}`);
      }
    }

    if (operatorNote?.trim()) {
      lines.push(`\nOperatör notu: ${operatorNote.trim()}`);
    }

    lines.push('\nYukarıdaki bilgilere göre vatandaşa uygun bir yanıt oluştur:');
    return lines.join('\n');
  }

  private buildDeterministicSuggestion(ticket: TicketWithContext): SuggestReplyResult {
    const statusMessages: Record<string, string> = {
      NEW: 'talebiniz sistemimize alınmış olup en kısa sürede değerlendirilecektir.',
      TRIAGED: 'talebiniz inceleme aşamasına alınmış olup ilgili birime yönlendirilecektir.',
      ASSIGNED: 'talebiniz ilgili birime iletilmiş olup ekibimiz en kısa sürede çalışmaya başlayacaktır.',
      IN_PROGRESS: 'talebiniz üzerinde ekibimiz çalışmaktadır. En kısa sürede bilgilendirme yapılacaktır.',
      WAITING_INFO: 'talebinizin işleme alınabilmesi için ek bilgi veya belge gerekmektedir. Lütfen eksik bilgileri tamamlayınız.',
      RESOLVED: 'talebiniz tamamlanmıştır. Hizmetimizden memnun kaldıysanız değerlendirme yapabilirsiniz.',
      CLOSED: 'talebiniz kapatılmıştır. Yeni bir talep oluşturmak için sistemimizi kullanabilirsiniz.',
    };

    const statusText = statusMessages[ticket.status] ?? 'talebiniz işleme alınmıştır.';
    const deptText = ticket.department ? `${ticket.department.name} birimince ` : '';

    const suggestion = [
      `Sayın Vatandaşımız,`,
      ``,
      `"${ticket.title}" konulu talebiniz ${deptText}${statusText}`,
      ``,
      `Belediyemize duyduğunuz güven için teşekkür ederiz. Daha fazla bilgi almak için iletişim kanallarımızı kullanabilirsiniz.`,
      ``,
      `Saygılarımızla,`,
      `Belediye Hizmet Birimi`,
    ].join('\n');

    return { suggestion, model: 'deterministic-fallback', tokensUsed: null };
  }

  private readAnthropicConfig() {
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || '';
    const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').trim().replace(/\/+$/, '');
    return {
      enabled: provider === 'anthropic' && Boolean(apiKey),
      apiKey,
      baseUrl,
      model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001',
      timeoutMs: 12_000,
      version: process.env.ANTHROPIC_API_VERSION?.trim() || '2023-06-01',
    };
  }
}
