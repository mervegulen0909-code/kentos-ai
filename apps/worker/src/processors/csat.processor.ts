import { PrismaClient, TicketStatus } from '@kentos/database';
import { logger } from '../logger.js';

const prisma = new PrismaClient();

type CsatJobData = {
  ticketId: string;
  tenantId: string;
};

export async function processCsatJob(job: { name: string; data: CsatJobData }) {
  const { ticketId, tenantId } = job.data;

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    include: {
      citizen: true,
      tenant: { select: { slug: true } },
    },
  });

  if (!ticket) {
    return { processor: 'csat', skipped: 'ticket-not-found' };
  }

  if (ticket.status !== TicketStatus.RESOLVED) {
    return { processor: 'csat', skipped: 'ticket-not-resolved', status: ticket.status };
  }

  const phone = ticket.citizen?.phone?.trim();
  if (!phone) {
    return { processor: 'csat', skipped: 'no-phone' };
  }

  // Check if CSAT already sent (csatRespondedAt or csatScore already set)
  if ((ticket as unknown as { csatScore: number | null; csatRespondedAt: Date | null }).csatScore !== null) {
    return { processor: 'csat', skipped: 'already-responded' };
  }

  const gatewayUrl = resolveGatewayUrl();
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!gatewayUrl || !internalKey) {
    logger.warn('[csat] Gateway not configured — skipping CSAT for ticket', { ticketId });
    return { processor: 'csat', skipped: 'gateway-not-configured' };
  }

  const csatMessage = `Sayın vatandaşımız, #${ticket.ticketNo} numaralı talebiniz çözüme kavuşturulmuştur. Hizmetimizden ne kadar memnun kaldınız? Lütfen 1-5 arasında bir puan verin. (1: Çok Kötü, 5: Mükemmel)`;

  try {
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-kentos-internal-key': internalKey,
      },
      body: JSON.stringify({
        tenantId,
        tenantSlug: ticket.tenant?.slug ?? '',
        channel: 'WHATSAPP',
        conversationId: ticketId,
        recipient: { phone },
        text: csatMessage,
      }),
    });

    if (!response.ok) {
      logger.warn('[csat] Gateway rejected CSAT message', { ticketId, status: response.status });
      return { processor: 'csat', sent: false, ticketId };
    }

    logger.info('[csat] CSAT message sent', { ticketId, phone: phone.slice(0, 6) + '***' });
    return { processor: 'csat', sent: true, ticketId };
  } catch (err) {
    logger.error('[csat] Failed to send CSAT message', { ticketId, error: String(err) });
    throw err; // rethrow for BullMQ retry
  }
}

function resolveGatewayUrl(): string | null {
  const direct = process.env.WHATSAPP_GATEWAY_OUTBOUND_URL;
  if (direct) return direct;
  const base = process.env.WHATSAPP_GATEWAY_BASE_URL ?? process.env.KENTOS_GATEWAY_BASE_URL ?? process.env.CHANNEL_GATEWAY_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/internal/whatsapp/outbound`;
}
