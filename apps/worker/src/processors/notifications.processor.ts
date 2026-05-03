import { PrismaClient } from '@kentos/database';
import type { NotificationJobData } from '@kentos/shared';

const prisma = new PrismaClient();

function providerName() {
  return process.env.WHATSAPP_PROVIDER === 'meta-cloud' ? 'meta-cloud' : 'baileys';
}

function externalMessageId(to: string) {
  const provider = providerName();
  const prefix = provider === 'meta-cloud' ? 'meta-pending' : 'demo';
  return `${prefix}-${Date.now()}-${to}`;
}

export async function processNotificationJob(job: { name: string; data: NotificationJobData }) {
  const message = await prisma.ticketMessage.findFirst({
    where: { id: job.data.messageId },
    include: {
      ticket: {
        include: {
          citizen: true,
        },
      },
    },
  });

  if (!message) {
    return { processor: 'notifications', job: job.name, skipped: 'message_not_found' };
  }

  const to = message.ticket.citizen?.phone?.trim();
  if (!to || message.senderType === 'CITIZEN' || message.visibility !== 'PUBLIC') {
    return { processor: 'notifications', job: job.name, skipped: 'not_deliverable' };
  }

  const provider = providerName();
  const sentExternalMessageId = message.externalMessageId ?? externalMessageId(to);
  if (!message.externalMessageId) {
    await prisma.ticketMessage.update({
      where: { id: message.id },
      data: { externalMessageId: sentExternalMessageId },
    });
  }

  const existingDeliveryEvent = await prisma.channelEvent.findFirst({
    where: {
      tenantId: message.tenantId,
      channel: 'WHATSAPP',
      provider,
      externalEventId: sentExternalMessageId,
    },
    select: { id: true },
  });

  if (existingDeliveryEvent) {
    return {
      processor: 'notifications',
      job: job.name,
      delivered: true,
      idempotent: true,
      provider,
      externalMessageId: sentExternalMessageId,
    };
  }

  try {
    await prisma.channelEvent.create({
      data: {
        tenantId: message.tenantId,
        channel: 'WHATSAPP',
        provider,
        externalEventId: sentExternalMessageId,
        payload: {
          direction: 'OUTBOUND',
          messageId: message.id,
          ticketId: message.ticketId,
          to,
          body: message.body,
        },
        processedAt: new Date(),
      },
    });
  } catch (error) {
    const existingEventAfterRace = await prisma.channelEvent.findFirst({
      where: {
        tenantId: message.tenantId,
        channel: 'WHATSAPP',
        provider,
        externalEventId: sentExternalMessageId,
      },
      select: { id: true },
    });

    if (!existingEventAfterRace) throw error;
    return {
      processor: 'notifications',
      job: job.name,
      delivered: true,
      idempotent: true,
      provider,
      externalMessageId: sentExternalMessageId,
    };
  }

  return {
    processor: 'notifications',
    job: job.name,
    delivered: true,
    provider,
    externalMessageId: sentExternalMessageId,
  };
}
