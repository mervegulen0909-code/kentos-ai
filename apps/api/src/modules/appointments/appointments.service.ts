import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface CreateSlotDto {
  departmentId?: string;
  startsAt: string;
  endsAt: string;
  capacity?: number;
}

interface BookAppointmentDto {
  slotId: string;
  citizenName: string;
  citizenPhone?: string;
  note?: string;
}

@Injectable()
export class AppointmentsService {
  private get db(): any { return this.prisma; }

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async resolveTenantId(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant bulunamadı: ${tenantSlug}`);
    return tenant.id;
  }

  // --- Admin: slot management ---

  async listSlots(tenantId: string, from?: string, to?: string) {
    return this.db.appointmentSlot.findMany({
      where: {
        tenantId,
        ...(from || to ? {
          startsAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createSlot(user: AuthenticatedUser, dto: CreateSlotDto) {
    return this.db.appointmentSlot.create({
      data: {
        tenantId: user.tenantId,
        departmentId: dto.departmentId ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        capacity: dto.capacity ?? 1,
        booked: 0,
      },
    });
  }

  async deleteSlot(user: AuthenticatedUser, id: string) {
    const slot = await this.db.appointmentSlot.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!slot) throw new NotFoundException(`Slot bulunamadı: ${id}`);
    if (slot.booked > 0) throw new BadRequestException('Dolu slotlar silinemez');
    await this.db.appointmentSlot.delete({ where: { id } });
    return { ok: true };
  }

  // --- Admin: appointment management ---

  async listAppointments(user: AuthenticatedUser, status?: string) {
    return this.db.appointment.findMany({
      where: {
        tenantId: user.tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        slot: { select: { startsAt: true, endsAt: true, department: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAppointmentStatus(user: AuthenticatedUser, id: string, status: string) {
    const appt = await this.db.appointment.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!appt) throw new NotFoundException(`Randevu bulunamadı: ${id}`);
    return this.db.appointment.update({ where: { id }, data: { status, updatedAt: new Date() } });
  }

  // --- Public: citizen booking ---

  async getAvailableSlots(tenantId: string, from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : null;
    if (toDate) {
      return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT s.id, s."startsAt", s."endsAt", s.capacity, s.booked,
               d.id AS "departmentId", d.name AS "departmentName"
        FROM "AppointmentSlot" s
        LEFT JOIN "Department" d ON d.id = s."departmentId"
        WHERE s."tenantId" = ${tenantId}
          AND s."booked" < s."capacity"
          AND s."startsAt" >= ${fromDate}
          AND s."startsAt" <= ${toDate}
        ORDER BY s."startsAt" ASC LIMIT 200
      `;
    }
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s.id, s."startsAt", s."endsAt", s.capacity, s.booked,
             d.id AS "departmentId", d.name AS "departmentName"
      FROM "AppointmentSlot" s
      LEFT JOIN "Department" d ON d.id = s."departmentId"
      WHERE s."tenantId" = ${tenantId}
        AND s."booked" < s."capacity"
        AND s."startsAt" >= ${fromDate}
      ORDER BY s."startsAt" ASC LIMIT 200
    `;
  }

  async getAvailableSlotsBySlug(tenantSlug: string, from?: string, to?: string) {
    const tenantId = await this.resolveTenantId(tenantSlug);
    return this.getAvailableSlots(tenantId, from, to);
  }

  async bookAppointment(tenantId: string, citizenId: string | undefined, dto: BookAppointmentDto) {
    const slot = await this.db.appointmentSlot.findFirst({
      where: { id: dto.slotId, tenantId },
    });
    if (!slot) throw new NotFoundException(`Slot bulunamadı: ${dto.slotId}`);
    if (slot.booked >= slot.capacity) throw new BadRequestException('Bu slot dolu');

    const appt = await this.db.appointment.create({
      data: {
        tenantId,
        slotId: dto.slotId,
        citizenId: citizenId ?? null,
        citizenName: dto.citizenName,
        citizenPhone: dto.citizenPhone ?? null,
        note: dto.note ?? null,
        status: 'PENDING',
      },
    });

    await this.db.appointmentSlot.update({
      where: { id: dto.slotId },
      data: { booked: { increment: 1 } },
    });

    return appt;
  }

  async bookByTenantSlug(tenantSlug: string, citizenId: string | undefined, dto: BookAppointmentDto) {
    const tenantId = await this.resolveTenantId(tenantSlug);
    return this.bookAppointment(tenantId, citizenId, dto);
  }

  async cancelAppointment(tenantId: string, id: string, citizenId?: string) {
    const where: Record<string, unknown> = { id, tenantId };
    if (citizenId) where['citizenId'] = citizenId;
    const appt = await this.db.appointment.findFirst({ where });
    if (!appt) throw new NotFoundException(`Randevu bulunamadı: ${id}`);
    if (appt.status === 'CANCELLED') throw new BadRequestException('Randevu zaten iptal edilmiş');

    await this.db.appointment.update({ where: { id }, data: { status: 'CANCELLED', updatedAt: new Date() } });
    await this.db.appointmentSlot.update({ where: { id: appt.slotId }, data: { booked: { decrement: 1 } } });

    return { ok: true };
  }

  async cancelByTenantSlug(tenantSlug: string, id: string, citizenId?: string) {
    const tenantId = await this.resolveTenantId(tenantSlug);
    return this.cancelAppointment(tenantId, id, citizenId);
  }
}
