import { Inject, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GenerateReportDto } from './dto/generate-report.dto.js';
import { ReportsQueueService } from './reports-queue.service.js';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportsQueueService) private readonly reportsQueue: ReportsQueueService,
  ) {}

  async generate(user: AuthenticatedUser, dto: GenerateReportDto) {
    const type = dto.type ?? 'weekly_summary';
    await this.reportsQueue.enqueue({
      tenantId: user.tenantId,
      type,
      requestedBy: user.id,
    });
    return { queued: true, type, tenantId: user.tenantId };
  }

  async list(
    user: AuthenticatedUser,
    filters: { type?: string; page?: number; limit?: number },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      tenantId: user.tenantId,
      ...(filters.type ? { type: filters.type } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.managerReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.managerReport.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async get(user: AuthenticatedUser, id: string) {
    const report = await this.prisma.managerReport.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!report) {
      throw new NotFoundException(`Rapor bulunamadı: ${id}`);
    }

    return report;
  }

  // 6.2 — Rapor abonelikleri
  async listSubscriptions(user: AuthenticatedUser) {
    return this.prisma.$queryRaw<Array<{ id: string; reportType: string; frequency: string; email: string; isActive: boolean; lastSentAt: Date | null; createdAt: Date }>>`
      SELECT "id","reportType","frequency","email","isActive","lastSentAt","createdAt"
      FROM "ReportSubscription"
      WHERE "tenantId" = ${user.tenantId} AND "userId" = ${user.id} AND "isActive" = true
      ORDER BY "createdAt" DESC
    `;
  }

  async createSubscription(user: AuthenticatedUser, dto: { reportType: string; frequency?: string; email?: string }) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "ReportSubscription" ("id","tenantId","userId","reportType","frequency","email","isActive","createdAt","updatedAt")
      VALUES (gen_random_uuid()::text, ${user.tenantId}, ${user.id}, ${dto.reportType}, ${dto.frequency ?? 'WEEKLY'}, ${dto.email ?? user.email}, true, NOW(), NOW())
      RETURNING "id"
    `;
    return { id: rows[0]!.id, reportType: dto.reportType, frequency: dto.frequency ?? 'WEEKLY', email: dto.email ?? user.email };
  }

  async removeSubscription(user: AuthenticatedUser, id: string) {
    await this.prisma.$executeRaw`
      UPDATE "ReportSubscription" SET "isActive" = false, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "userId" = ${user.id} AND "tenantId" = ${user.tenantId}
    `;
    return { ok: true };
  }

  // 6.1 — CSV export
  async exportCsv(
    user: AuthenticatedUser,
    options: { from?: Date; to?: Date; format?: 'csv' | 'json' },
  ): Promise<StreamableFile> {
    const where = {
      tenantId: user.tenantId,
      ...(options.from || options.to
        ? { createdAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    };

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      select: {
        ticketNo: true, title: true, status: true, priority: true, channel: true,
        createdAt: true, resolvedAt: true, closedAt: true,
        department: { select: { name: true } },
        category: { select: { name: true } },
        addressText: true,
      },
    });

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['Talep No', 'Başlık', 'Durum', 'Öncelik', 'Kanal', 'Birim', 'Kategori', 'Adres', 'Oluşturulma', 'Çözüm', 'Kapanma'];
    const rows = tickets.map((t) => [
      esc(t.ticketNo), esc(t.title), esc(t.status), esc(t.priority), esc(t.channel),
      esc(t.department?.name), esc(t.category?.name), esc(t.addressText),
      esc(t.createdAt.toISOString()), esc(t.resolvedAt?.toISOString()), esc(t.closedAt?.toISOString()),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const buffer = Buffer.from('﻿' + csv, 'utf-8'); // UTF-8 BOM for Excel compatibility
    const readable = Readable.from(buffer);
    return new StreamableFile(readable, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="kentOS-tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }
}
