import { TicketPriority } from '@kentos/database';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { UpdateTenantDto } from './dto/update-tenant.dto.js';

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, tickets: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        departments: true,
        categories: true,
        slaPolicies: true,
      },
    });
    if (!tenant) throw new NotFoundException('Kiracı bulunamadı.');
    return tenant;
  }

  async createTenant(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Bu slug zaten kullanılıyor');

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        timezone: dto.timezone ?? 'Europe/Istanbul',
        locale: dto.locale ?? 'tr-TR',
        status: 'ACTIVE',
      },
    });
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kiracı bulunamadı.');

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.widgetEnabled !== undefined && { widgetEnabled: dto.widgetEnabled }),
        ...(dto.widgetTitle !== undefined && { widgetTitle: dto.widgetTitle }),
        ...(dto.widgetWelcome !== undefined && { widgetWelcome: dto.widgetWelcome }),
      },
    });
  }

  async seedTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Kiracı bulunamadı.');

    await this.prisma.$transaction(async (tx) => {
      await tx.department.createMany({
        data: [
          { tenantId: id, code: 'FEN', name: 'Fen İşleri', description: 'Altyapı ve yapı işleri' },
          { tenantId: id, code: 'TEMİZLİK', name: 'Temizlik İşleri', description: 'Çevre temizliği' },
          { tenantId: id, code: 'PARK', name: 'Park ve Bahçeler', description: 'Yeşil alan bakımı' },
        ],
        skipDuplicates: true,
      });

      await tx.slaPolicy.createMany({
        data: [
          { tenantId: id, priority: TicketPriority.LOW, responseMinutes: 480, resolutionMinutes: 4320 },
          { tenantId: id, priority: TicketPriority.NORMAL, responseMinutes: 240, resolutionMinutes: 1440 },
          { tenantId: id, priority: TicketPriority.HIGH, responseMinutes: 60, resolutionMinutes: 480 },
          { tenantId: id, priority: TicketPriority.URGENT, responseMinutes: 15, resolutionMinutes: 120 },
        ],
        skipDuplicates: true,
      });
    });

    return { tenantId: id, seeded: true, departments: 3, slaPolicies: 4 };
  }
}
