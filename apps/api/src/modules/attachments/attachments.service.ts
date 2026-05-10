import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, TicketStatus, UserRole } from '@kentos/database';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentMediaQueueService } from './attachment-media-queue.service.js';
import { AttachmentStorageService } from './attachment-storage.service.js';
import { ConfirmAttachmentUploadDto } from './dto/confirm-attachment-upload.dto.js';
import { InitiateAttachmentUploadDto } from './dto/initiate-attachment-upload.dto.js';
import { InitiatePublicAttachmentUploadDto } from './dto/initiate-public-attachment-upload.dto.js';

type AttachmentContext = {
  ticketId?: string | null;
  messageId?: string | null;
};

@Injectable()
export class AttachmentsService {
  private readonly defaultAllowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain',
  ]);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AttachmentStorageService) private readonly storage: AttachmentStorageService,
    @Inject(AttachmentMediaQueueService) private readonly mediaQueue: AttachmentMediaQueueService,
  ) {}

  async initiateAdminUpload(user: AuthenticatedUser, dto: InitiateAttachmentUploadDto) {
    const metadata = this.normalizeMetadata(dto);
    const context = await this.resolveAdminContext(user, dto);
    const presigned = await this.storage.createPresignedUpload({
      tenantId: user.tenantId,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
    });
    const attachment = await this.prisma.attachment.create({
      data: {
        tenantId: user.tenantId,
        ticketId: context.ticketId,
        messageId: context.messageId,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        storageKey: presigned.storageKey,
        uploadedByType: AuditActorType.USER,
      },
    });

    return this.toInitiateResponse(attachment, presigned);
  }

  async initiatePublicUpload(tenantSlug: string, dto: InitiatePublicAttachmentUploadDto) {
    const metadata = this.normalizeMetadata(dto);
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');

    const ticketId = dto.trackingToken
      ? (await this.requirePublicTicketForAttachment(tenant.id, dto.trackingToken, dto.contact)).id
      : undefined;
    const presigned = await this.storage.createPresignedUpload({
      tenantId: tenant.id,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
    });
    const attachment = await this.prisma.attachment.create({
      data: {
        tenantId: tenant.id,
        ticketId,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        storageKey: presigned.storageKey,
        uploadedByType: AuditActorType.CITIZEN,
      },
    });

    return this.toInitiateResponse(attachment, presigned);
  }

  async confirmAdminUpload(user: AuthenticatedUser, attachmentId: string, dto: ConfirmAttachmentUploadDto) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId: user.tenantId },
      include: { message: true, ticket: true },
    });
    if (!attachment) throw new NotFoundException('Ek bulunamadi.');
    await this.requireAdminAttachmentScope(user, attachment.ticketId ?? attachment.message?.ticketId ?? null);

    return this.confirmAttachment({
      attachmentId,
      tenantId: user.tenantId,
      checksumSha256: dto.checksumSha256,
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      auditTicketId: attachment.ticketId ?? attachment.message?.ticketId ?? null,
    });
  }

  async confirmPublicUpload(tenantSlug: string, attachmentId: string, dto: ConfirmAttachmentUploadDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.status !== 'ACTIVE') throw new NotFoundException('Belediye bulunamadi.');

    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId: tenant.id, uploadedByType: AuditActorType.CITIZEN },
      include: { message: true },
    });
    if (!attachment) throw new NotFoundException('Ek bulunamadi.');

    return this.confirmAttachment({
      attachmentId,
      tenantId: tenant.id,
      checksumSha256: dto.checksumSha256,
      actorType: AuditActorType.CITIZEN,
      auditTicketId: attachment.ticketId ?? attachment.message?.ticketId ?? null,
    });
  }

  private async confirmAttachment(input: {
    attachmentId: string;
    tenantId: string;
    checksumSha256: string;
    actorType: AuditActorType;
    actorUserId?: string;
    auditTicketId?: string | null;
  }) {
    const checksumSha256 = this.normalizeChecksum(input.checksumSha256);
    const attachment = await this.prisma.attachment.update({
      where: { id: input.attachmentId },
      data: { checksumSha256 },
    });

    if (input.auditTicketId) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          ticketId: input.auditTicketId,
          actorType: input.actorType,
          actorUserId: input.actorUserId,
          action: 'ticket.attachment_confirmed',
          after: {
            attachmentId: attachment.id,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            checksumSha256,
          },
        },
      });
    }

    await this.mediaQueue.enqueueAttachment({
      attachmentId: attachment.id,
      tenantId: attachment.tenantId,
      storageKey: attachment.storageKey,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      checksumSha256,
    });

    return this.toAttachmentResponse(attachment);
  }

  private normalizeMetadata(dto: InitiateAttachmentUploadDto) {
    const fileName = dto.fileName.trim();
    const mimeType = dto.mimeType.trim().toLowerCase();
    const sizeBytes = dto.sizeBytes;
    if (!fileName) throw new BadRequestException('Dosya adi zorunludur.');
    if (!this.allowedMimeTypes().has(mimeType)) throw new BadRequestException('Dosya tipi desteklenmiyor.');
    if (sizeBytes > this.maxSizeBytes()) throw new BadRequestException('Dosya boyutu yukleme limitini asiyor.');
    return { fileName, mimeType, sizeBytes };
  }

  private async resolveAdminContext(user: AuthenticatedUser, dto: InitiateAttachmentUploadDto): Promise<AttachmentContext> {
    if (dto.ticketId && dto.messageId) {
      const message = await this.prisma.ticketMessage.findFirst({
        where: { id: dto.messageId, tenantId: user.tenantId, ticketId: dto.ticketId },
        select: { ticketId: true },
      });
      if (!message) throw new NotFoundException('Mesaj bulunamadi.');
      await this.requireAdminAttachmentScope(user, message.ticketId);
      return { ticketId: dto.ticketId, messageId: dto.messageId };
    }

    if (dto.messageId) {
      const message = await this.prisma.ticketMessage.findFirst({
        where: { id: dto.messageId, tenantId: user.tenantId },
        select: { ticketId: true },
      });
      if (!message) throw new NotFoundException('Mesaj bulunamadi.');
      await this.requireAdminAttachmentScope(user, message.ticketId);
      return { messageId: dto.messageId };
    }

    if (dto.ticketId) {
      await this.requireAdminAttachmentScope(user, dto.ticketId);
      return { ticketId: dto.ticketId };
    }

    return {};
  }

  private async requireAdminAttachmentScope(user: AuthenticatedUser, ticketId: string | null) {
    if (!ticketId) return;
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId: user.tenantId },
      select: { id: true, departmentId: true },
    });
    if (!ticket) throw new NotFoundException('Talep bulunamadi.');
    if (user.role !== UserRole.DEPARTMENT_STAFF) return;

    const allowedDepartment = ticket.departmentId
      ? await this.prisma.userDepartment.findFirst({
          where: { userId: user.id, departmentId: ticket.departmentId, department: { tenantId: user.tenantId, isActive: true } },
          select: { departmentId: true },
        })
      : null;
    if (!allowedDepartment) throw new ForbiddenException('Bu talep icin ek yukleme yetkiniz yok.');
  }

  private async requirePublicTicketForAttachment(tenantId: string, trackingToken: string, contact?: string) {
    const normalizedToken = trackingToken.trim().toUpperCase();
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, publicTrackingToken: normalizedToken },
      include: { citizen: true },
    });
    if (!ticket) throw new NotFoundException('Basvuru bulunamadi.');
    if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.REJECTED) {
      throw new ForbiddenException(`${ticket.status} durumundaki basvuruya ek yuklenemez.`);
    }

    const normalizedContact = contact?.trim();
    if (!normalizedContact || (ticket.citizen?.phone !== normalizedContact && ticket.citizen?.email !== normalizedContact)) {
      throw new ForbiddenException('Basvuruya ek yuklemek icin kayitli iletisim bilgisini girin.');
    }
    return ticket;
  }

  private allowedMimeTypes() {
    const configured = process.env.ATTACHMENT_ALLOWED_MIME_TYPES
      ?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return configured?.length ? new Set(configured) : this.defaultAllowedMimeTypes;
  }

  private maxSizeBytes() {
    const configured = Number.parseInt(process.env.ATTACHMENT_MAX_BYTES ?? '', 10);
    return Number.isFinite(configured) && configured > 0 ? configured : 20 * 1024 * 1024;
  }

  private normalizeChecksum(value: string) {
    const checksum = value.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(checksum)) throw new BadRequestException('SHA-256 checksum gecersiz.');
    return checksum;
  }

  private toInitiateResponse(
    attachment: { id: string; storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
    presigned: { uploadUrl: string; headers: Record<string, string>; expiresAt: string },
  ) {
    return {
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadUrl: presigned.uploadUrl,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt,
    };
  }

  private toAttachmentResponse(attachment: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string | null;
    createdAt: Date;
  }) {
    return {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      checksumSha256: attachment.checksumSha256,
      createdAt: attachment.createdAt,
    };
  }
}
