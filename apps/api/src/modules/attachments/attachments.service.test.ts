import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { AuditActorType } from '@kentos/database';
import { AttachmentsService } from './attachments.service.js';

const checksum = 'a'.repeat(64);

function buildService(options: { ticketStatus?: string } = {}) {
  const state = {
    attachments: [] as any[],
    audits: [] as any[],
    queued: [] as any[],
  };
  const prisma = {
    tenant: {
      findUnique: async ({ where }: any) => where.slug === 'demo-belediye' ? { id: 'tenant-1', slug: where.slug, status: 'ACTIVE' } : null,
    },
    ticket: {
      findFirst: async ({ where }: any) => {
        if (where.id === 'ticket-1' || where.publicTrackingToken === 'TK-AAAAAAAAAAAAAAAA') {
          return {
            id: 'ticket-1',
            tenantId: 'tenant-1',
            departmentId: 'dep-1',
            status: options.ticketStatus ?? 'NEW',
            citizen: { phone: '+905551112233', email: 'vatandas@example.org' },
          };
        }
        return null;
      },
    },
    ticketMessage: {
      findFirst: async () => null,
    },
    userDepartment: {
      findFirst: async ({ where }: any) => where.userId === 'staff-1' && where.departmentId === 'dep-1'
        ? { departmentId: 'dep-1' }
        : null,
    },
    attachment: {
      create: async ({ data }: any) => {
        const attachment = { id: `att-${state.attachments.length + 1}`, checksumSha256: null, createdAt: new Date(), ...data };
        state.attachments.push(attachment);
        return attachment;
      },
      findFirst: async ({ where }: any) => {
        return state.attachments.find((attachment) => {
          if (where.id && attachment.id !== where.id) return false;
          if (where.tenantId && attachment.tenantId !== where.tenantId) return false;
          if (where.uploadedByType && attachment.uploadedByType !== where.uploadedByType) return false;
          return true;
        }) ?? null;
      },
      findMany: async ({ where }: any) => {
        const ids = where.id?.in ?? [];
        return state.attachments.filter((attachment) => {
          if (ids.length && !ids.includes(attachment.id)) return false;
          if (where.tenantId && attachment.tenantId !== where.tenantId) return false;
          if (where.uploadedByType && attachment.uploadedByType !== where.uploadedByType) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const attachment = state.attachments.find((item) => item.id === where.id);
        Object.assign(attachment, data);
        return attachment;
      },
      updateMany: async ({ where, data }: any) => {
        const ids = where.id?.in ?? [];
        let count = 0;
        for (const attachment of state.attachments) {
          if (ids.length && !ids.includes(attachment.id)) continue;
          if (where.tenantId && attachment.tenantId !== where.tenantId) continue;
          Object.assign(attachment, data);
          count += 1;
        }
        return { count };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  const storage = {
    createPresignedUpload: async ({ tenantId, fileName }: any) => ({
      storageKey: `attachments/${tenantId}/test/${fileName.replace(/^.*[\\/]/, '')}`,
      uploadUrl: 'https://storage.example/upload',
      headers: { 'content-type': 'image/png' },
      expiresAt: '2026-05-10T12:00:00.000Z',
    }),
  };
  const queue = {
    enqueueAttachment: async (data: any) => {
      state.queued.push(data);
      return true;
    },
  };

  return { service: new AttachmentsService(prisma as any, storage as any, queue as any), state };
}

async function testAdminUploadAndConfirm() {
  const { service, state } = buildService();
  const initiated = await service.initiateAdminUpload(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    { fileName: 'photo.png', mimeType: 'IMAGE/PNG', sizeBytes: 512, ticketId: 'ticket-1' },
  );
  assert.equal(initiated.attachmentId, 'att-1');
  assert.equal(initiated.mimeType, 'image/png');
  assert.equal(Object.hasOwn(initiated, 'storageKey'), false);

  const confirmed = await service.confirmAdminUpload(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    initiated.attachmentId,
    { checksumSha256: checksum.toUpperCase() },
  );
  assert.equal(confirmed.checksumSha256, checksum);
  assert.equal(state.queued[0].attachmentId, initiated.attachmentId);
  assert.equal(state.audits[0].action, 'ticket.attachment_confirmed');
}

async function testPublicUploadRequiresTicketContact() {
  const { service } = buildService();
  await assert.rejects(
    () => service.initiatePublicUpload('demo-belediye', {
      fileName: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: 512,
      trackingToken: 'TK-AAAAAAAAAAAAAAAA',
      contact: '+900000000000',
    }),
    ForbiddenException,
  );
}

async function testPublicUploadCanConfirmUnattached() {
  const { service, state } = buildService();
  const initiated = await service.initiatePublicUpload('demo-belediye', {
    fileName: '../kimlik.png',
    mimeType: 'image/png',
    sizeBytes: 512,
  });
  await service.confirmPublicUpload('demo-belediye', initiated.attachmentId, { checksumSha256: checksum });
  assert.equal(state.attachments[0].uploadedByType, AuditActorType.CITIZEN);
  assert.equal(state.queued[0].storageKey, 'attachments/tenant-1/test/kimlik.png');
}

async function testRequiresConfirmedAttachmentBeforeBinding() {
  const { service } = buildService();
  const initiated = await service.initiateAdminUpload(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    { fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 512 },
  );

  await assert.rejects(
    () => service.attachAdminToTicket(
      { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
      'ticket-1',
      [initiated.attachmentId],
    ),
    ForbiddenException,
  );
}

async function testRejectsClosedTicketBinding() {
  const { service } = buildService({ ticketStatus: 'CLOSED' });
  await assert.rejects(
    () => service.initiateAdminUpload(
      { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
      { fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 512, ticketId: 'ticket-1' },
    ),
    ForbiddenException,
  );
}

async function testBindsConfirmedAttachmentToMessage() {
  const { service, state } = buildService();
  const initiated = await service.initiateAdminUpload(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    { fileName: 'photo.png', mimeType: 'image/png', sizeBytes: 512 },
  );
  await service.confirmAdminUpload(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    initiated.attachmentId,
    { checksumSha256: checksum },
  );
  await service.attachAdminToMessage(
    { id: 'admin-1', tenantId: 'tenant-1', email: 'admin@example.org', role: 'TENANT_ADMIN' },
    'ticket-1',
    'message-1',
    [initiated.attachmentId],
  );

  assert.equal(state.attachments[0].ticketId, 'ticket-1');
  assert.equal(state.attachments[0].messageId, 'message-1');
  assert.equal(state.audits.at(-1).action, 'ticket.message_attachments_linked');
}

await testAdminUploadAndConfirm();
await testPublicUploadRequiresTicketContact();
await testPublicUploadCanConfirmUnattached();
await testRequiresConfirmedAttachmentBeforeBinding();
await testRejectsClosedTicketBinding();
await testBindsConfirmedAttachmentToMessage();

console.log('attachment upload service tests passed');
