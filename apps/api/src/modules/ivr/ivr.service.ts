import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class IvrService {
  private readonly logger = new Logger(IvrService.name);
  private get db(): any { return this.prisma; }

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Called when Twilio first connects — returns TwiML to greet and record */
  greeting(tenantSlug: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="tr-TR" voice="Polly.Filiz">
    Belediye çağrı merkezine hoş geldiniz. Lütfen talebinizi kısa ve öz olarak belirtin. Kayıt başlıyor.
  </Say>
  <Record maxLength="120" transcribe="false" action="https://${process.env.API_PUBLIC_URL ?? 'api.example.com'}/ivr/${tenantSlug}/recording" />
  <Say language="tr-TR">Teşekkürler, talebiniz alındı.</Say>
</Response>`;
  }

  /** Called by Twilio after recording completes */
  async handleRecording(tenantSlug: string, payload: {
    CallSid: string;
    From: string;
    To: string;
    RecordingUrl?: string;
    RecordingSid?: string;
  }): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) {
      this.logger.warn(`IVR: unknown tenant slug ${tenantSlug}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
    }

    // Upsert IvrCall record
    const call = await this.db.ivrCall.upsert({
      where: { callSid: payload.CallSid },
      create: {
        tenantId: tenant.id,
        callSid: payload.CallSid,
        from: payload.From,
        to: payload.To,
        recordingUrl: payload.RecordingUrl ?? null,
        status: 'INITIATED',
      },
      update: {
        recordingUrl: payload.RecordingUrl ?? null,
        updatedAt: new Date(),
      },
    });

    // Attempt transcription if Whisper/OpenAI configured
    if (payload.RecordingUrl && process.env.OPENAI_API_KEY) {
      this.transcribeAsync(call.id, payload.RecordingUrl, tenant.id).catch((e) =>
        this.logger.error(`Transcription failed: ${e}`),
      );
    }

    return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
  }

  private async transcribeAsync(callId: string, recordingUrl: string, tenantId: string): Promise<void> {
    try {
      // Download recording and send to Whisper
      const audioRes = await fetch(`${recordingUrl}.mp3`);
      if (!audioRes.ok) throw new Error(`Audio fetch failed: ${audioRes.status}`);
      const audioBuffer = await audioRes.arrayBuffer();

      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'recording.mp3');
      formData.append('model', 'whisper-1');
      formData.append('language', 'tr');

      const transcribeRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error(`Whisper failed: ${transcribeRes.status}`);
      const result = await transcribeRes.json() as { text: string };
      const transcript = result.text;

      await this.db.ivrCall.update({
        where: { id: callId },
        data: { transcript, status: 'TRANSCRIBED', updatedAt: new Date() },
      });

      this.logger.log(`IVR call ${callId} transcribed: ${transcript.slice(0, 80)}...`);
    } catch (e) {
      await this.db.ivrCall.update({
        where: { id: callId },
        data: { status: 'FAILED', updatedAt: new Date() },
      });
      throw e;
    }
  }

  async listCalls(tenantId: string, status?: string) {
    return this.db.ivrCall.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getCall(tenantId: string, id: string) {
    const call = await this.db.ivrCall.findFirst({ where: { id, tenantId } });
    if (!call) throw new NotFoundException(`IVR call not found: ${id}`);
    return call;
  }
}
