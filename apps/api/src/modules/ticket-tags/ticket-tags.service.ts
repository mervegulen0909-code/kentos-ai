import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex color (e.g. #6366f1)' })
  color?: string;
}

@Injectable()
export class TicketTagsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return this.prisma; }

  list(user: AuthenticatedUser) {
    return this.db.ticketTag.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateTagDto) {
    const existing = await this.db.ticketTag.findFirst({ where: { tenantId: user.tenantId, name: { equals: dto.name, mode: 'insensitive' } } });
    if (existing) throw new BadRequestException('Bu isimde bir etiket zaten mevcut.');
    return this.db.ticketTag.create({
      data: { tenantId: user.tenantId, name: dto.name, color: dto.color ?? '#6366f1' },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: Partial<CreateTagDto>) {
    const tag = await this.db.ticketTag.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!tag) throw new NotFoundException('Etiket bulunamadi.');
    return this.db.ticketTag.update({
      where: { id },
      data: { name: dto.name ?? tag.name, color: dto.color ?? tag.color },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const tag = await this.db.ticketTag.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!tag) throw new NotFoundException('Etiket bulunamadi.');
    await this.db.ticketTag.delete({ where: { id } });
    return { ok: true };
  }
}
