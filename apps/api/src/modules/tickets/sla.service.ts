import { Inject, Injectable } from '@nestjs/common';
import { TicketPriority } from '@kentos/database';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SlaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async calculateDeadlines(input: {
    tenantId: string;
    priority: TicketPriority;
    departmentId?: string | null;
    categoryId?: string | null;
    now?: Date;
  }) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: {
        tenantId: input.tenantId,
        priority: input.priority,
        isActive: true,
        OR: [
          { categoryId: input.categoryId ?? undefined },
          { departmentId: input.departmentId ?? undefined, categoryId: null },
          { departmentId: null, categoryId: null },
        ],
      },
      orderBy: [{ categoryId: 'desc' }, { departmentId: 'desc' }],
    });

    const now = input.now ?? new Date();
    const responseMinutes = policy?.responseMinutes ?? 4 * 60;
    const resolutionMinutes = policy?.resolutionMinutes ?? 3 * 24 * 60;

    return {
      firstResponseDueAt: new Date(now.getTime() + responseMinutes * 60_000),
      resolutionDueAt: new Date(now.getTime() + resolutionMinutes * 60_000),
    };
  }
}
