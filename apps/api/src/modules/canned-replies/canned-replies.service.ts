import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

export class CreateCannedReplyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(5)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  shortCode?: string;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean; // true = shared; false/undefined = personal
}

@Injectable()
export class CannedRepliesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return this.prisma; }

  async list(user: AuthenticatedUser) {
    return this.db.cannedReply.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [{ ownerId: null }, { ownerId: user.id }],
      },
      orderBy: [{ ownerId: 'asc' }, { title: 'asc' }],
    });
  }

  async create(user: AuthenticatedUser, dto: CreateCannedReplyDto) {
    return this.db.cannedReply.create({
      data: {
        tenantId: user.tenantId,
        ownerId: dto.isShared ? null : user.id,
        title: dto.title,
        body: dto.body,
        shortCode: dto.shortCode ?? null,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: Partial<CreateCannedReplyDto>) {
    const reply = await this.db.cannedReply.findFirst({ where: { id, tenantId: user.tenantId, isActive: true } });
    if (!reply) throw new NotFoundException('Hazir yanit bulunamadi.');

    // Only owners can edit personal replies; managers can edit shared ones
    if (reply.ownerId && reply.ownerId !== user.id) {
      throw new BadRequestException('Yalnizca kendi hazir yanitlarinizi duzeltebilirsiniz.');
    }

    return this.db.cannedReply.update({
      where: { id },
      data: {
        title: dto.title ?? reply.title,
        body: dto.body ?? reply.body,
        shortCode: dto.shortCode !== undefined ? dto.shortCode : reply.shortCode,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const reply = await this.db.cannedReply.findFirst({ where: { id, tenantId: user.tenantId, isActive: true } });
    if (!reply) throw new NotFoundException('Hazir yanit bulunamadi.');
    if (reply.ownerId && reply.ownerId !== user.id) {
      throw new BadRequestException('Yalnizca kendi hazir yanitlarinizi silebilirsiniz.');
    }
    await this.db.cannedReply.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }
}
