import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';

export class CreateWhatsappTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  name!: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['UTILITY', 'MARKETING', 'AUTHENTICATION'])
  category?: string;

  @IsOptional()
  components?: unknown[];
}

@Injectable()
export class WhatsappTemplatesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any { return this.prisma; }

  list(user: AuthenticatedUser) {
    return this.db.whatsappTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
    });
  }

  create(user: AuthenticatedUser, dto: CreateWhatsappTemplateDto) {
    return this.db.whatsappTemplate.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        language: dto.language ?? 'tr',
        category: dto.category ?? 'UTILITY',
        components: dto.components ?? [],
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: Partial<CreateWhatsappTemplateDto>) {
    const tpl = await this.db.whatsappTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!tpl) throw new NotFoundException('WhatsApp şablonu bulunamadı.');
    return this.db.whatsappTemplate.update({
      where: { id },
      data: {
        name: dto.name ?? tpl.name,
        language: dto.language ?? tpl.language,
        category: dto.category ?? tpl.category,
        components: dto.components ?? tpl.components,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const tpl = await this.db.whatsappTemplate.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!tpl) throw new NotFoundException('WhatsApp şablonu bulunamadı.');
    await this.db.whatsappTemplate.delete({ where: { id } });
    return { ok: true };
  }
}
