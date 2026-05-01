import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TicketNumberService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async nextTicketNo(tenantId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.ticket.count({
      where: {
        tenantId,
        ticketNo: { startsWith: `KNT-${year}-` },
      },
    });

    return `KNT-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
