import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MergeCitizenDto } from './dto/merge-citizen.dto.js';

@Injectable()
export class CitizensService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async merge(user: AuthenticatedUser, sourceId: string, dto: MergeCitizenDto) {
    const { mergeIntoId } = dto;

    if (sourceId === mergeIntoId) {
      throw new BadRequestException('Source and target citizen must be different');
    }

    const [source, target] = await Promise.all([
      this.prisma.citizen.findUnique({ where: { id: sourceId } }),
      this.prisma.citizen.findUnique({ where: { id: mergeIntoId } }),
    ]);

    if (!source || source.tenantId !== user.tenantId) throw new NotFoundException('Citizen not found');
    if (!target || target.tenantId !== user.tenantId) throw new NotFoundException('Target citizen not found');

    if (source.mergedIntoCitizenId) {
      throw new BadRequestException('Source citizen is already merged into another citizen');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({ where: { tenantId: user.tenantId, citizenId: sourceId }, data: { citizenId: mergeIntoId } });
      await tx.conversation.updateMany({ where: { tenantId: user.tenantId, citizenId: sourceId }, data: { citizenId: mergeIntoId } });

      // Re-parent identifiers that don't already exist on the target
      const sourceIdentifiers = await tx.citizenIdentifier.findMany({ where: { citizenId: sourceId } });
      const targetIdentifiers = await tx.citizenIdentifier.findMany({ where: { citizenId: mergeIntoId } });
      const targetKeys = new Set(targetIdentifiers.map((i) => `${i.kind}:${i.normalizedValue}`));

      for (const identifier of sourceIdentifiers) {
        const key = `${identifier.kind}:${identifier.normalizedValue}`;
        if (targetKeys.has(key)) {
          await tx.citizenIdentifier.delete({ where: { id: identifier.id } });
        } else {
          await tx.citizenIdentifier.update({ where: { id: identifier.id }, data: { citizenId: mergeIntoId } });
        }
      }

      await tx.citizen.update({
        where: { id: sourceId },
        data: { mergedIntoCitizenId: mergeIntoId, mergedAt: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          actorId: user.id,
          actorType: 'USER',
          action: 'citizen.merged',
          targetType: 'citizen',
          targetId: sourceId,
          meta: { mergeIntoId },
        },
      });
    });

    return { merged: true, sourceId, mergeIntoId, mergedAt: now.toISOString() };
  }
}
