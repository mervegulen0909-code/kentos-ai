import { logger } from '../logger.js';
import { getPrismaClient } from '../prisma-client.js';

type DigestJobData = { tenantId: string; managerEmail: string };

const POSTMARK_API = 'https://api.postmarkapp.com/email';

export async function processDigestJob(job: { name: string; data: DigestJobData }): Promise<{ ok: boolean }> {
  const prisma = getPrismaClient();
  const { tenantId, managerEmail } = job.data;
  logger.info('processDigestJob: building weekly digest', { tenantId, managerEmail });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [tenant, opened, resolved, breached] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.ticket.count({ where: { tenantId, createdAt: { gte: weekAgo } } }),
    prisma.ticket.count({ where: { tenantId, resolvedAt: { gte: weekAgo } } }),
    prisma.ticket.count({ where: { tenantId, slaBreachedAt: { gte: weekAgo, not: null } } }),
  ]);

  const avgRows = await prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
    SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600) as avg_hours
    FROM "Ticket"
    WHERE "tenantId" = ${tenantId} AND "resolvedAt" >= ${weekAgo}
  `;
  const avgHours = avgRows[0]?.avg_hours != null ? Math.round(avgRows[0].avg_hours) : null;

  const token = process.env.POSTMARK_SERVER_TOKEN?.trim() ?? '';
  const from = `${process.env.MAIL_FROM_NAME ?? 'KentOS'} <${process.env.MAIL_FROM_ADDRESS ?? ''}>`;

  if (!token || !process.env.MAIL_FROM_ADDRESS) {
    logger.warn('processDigestJob: POSTMARK_SERVER_TOKEN or MAIL_FROM_ADDRESS not set — skipping email send');
    return { ok: false };
  }

  const tenantName = tenant?.name ?? tenantId;
  const period = `${weekAgo.toLocaleDateString('tr-TR')} – ${now.toLocaleDateString('tr-TR')}`;

  const textBody = [
    `KentOS Haftalık Yönetici Özeti — ${tenantName}`,
    `Dönem: ${period}`,
    '',
    `Açılan talep: ${opened}`,
    `Çözülen talep: ${resolved}`,
    `SLA ihlali: ${breached}`,
    avgHours != null ? `Ort. çözüm süresi: ${avgHours} saat` : '',
    '',
    'Bu rapor KentOS tarafından otomatik olarak gönderilmiştir.',
  ].filter(Boolean).join('\n');

  const htmlBody = `
    <h2>KentOS Haftalık Yönetici Özeti — ${tenantName}</h2>
    <p><strong>Dönem:</strong> ${period}</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
      <tr><td>Açılan talep</td><td><strong>${opened}</strong></td></tr>
      <tr><td>Çözülen talep</td><td><strong>${resolved}</strong></td></tr>
      <tr><td>SLA ihlali</td><td><strong>${breached}</strong></td></tr>
      ${avgHours != null ? `<tr><td>Ort. çözüm süresi</td><td><strong>${avgHours} saat</strong></td></tr>` : ''}
    </table>
    <p style="color:#888;font-size:12px">Bu rapor KentOS tarafından otomatik olarak gönderilmiştir.</p>
  `;

  const response = await fetch(POSTMARK_API, {
    method: 'POST',
    headers: { 'X-Postmark-Server-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: from,
      To: managerEmail,
      Subject: `KentOS Haftalık Özet — ${tenantName} (${period})`,
      TextBody: textBody,
      HtmlBody: htmlBody,
      MessageStream: 'outbound',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(`processDigestJob: Postmark send failed (${response.status}): ${text}`);
    return { ok: false };
  }

  logger.info('processDigestJob: digest email sent', { tenantId, managerEmail });
  return { ok: true };
}
