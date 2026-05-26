import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
}
