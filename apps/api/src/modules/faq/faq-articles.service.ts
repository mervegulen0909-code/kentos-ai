import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface CreateFaqDto {
  title: string;
  body: string;
  slug: string;
  lang?: string;
  isPublished?: boolean;
}

interface UpdateFaqDto {
  title?: string;
  body?: string;
  slug?: string;
  lang?: string;
  isPublished?: boolean;
}

@Injectable()
export class FaqArticlesService {
  private get db(): any { return this.prisma; }

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string, lang?: string, publishedOnly = false) {
    return this.db.faqArticle.findMany({
      where: {
        tenantId,
        ...(lang ? { lang } : {}),
        ...(publishedOnly ? { isPublished: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByTenantSlug(tenantSlug: string, lang?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant bulunamadı: ${tenantSlug}`);
    return this.list(tenant.id, lang, true);
  }

  async getBySlug(tenantId: string, slug: string, lang = 'tr') {
    const article = await this.db.faqArticle.findFirst({
      where: { tenantId, slug, lang, isPublished: true },
    });
    if (!article) throw new NotFoundException(`FAQ article not found: ${slug}`);
    await this.db.faqArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    return { ...article, viewCount: article.viewCount + 1 };
  }

  async getBySlugForPublic(tenantSlug: string, slug: string, lang = 'tr') {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant bulunamadı: ${tenantSlug}`);
    return this.getBySlug(tenant.id, slug, lang);
  }

  async create(user: AuthenticatedUser, dto: CreateFaqDto) {
    return this.db.faqArticle.create({
      data: {
        tenantId: user.tenantId,
        title: dto.title,
        body: dto.body,
        slug: dto.slug,
        lang: dto.lang ?? 'tr',
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateFaqDto) {
    const existing = await this.db.faqArticle.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) throw new NotFoundException(`FAQ article not found: ${id}`);
    return this.db.faqArticle.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const existing = await this.db.faqArticle.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!existing) throw new NotFoundException(`FAQ article not found: ${id}`);
    await this.db.faqArticle.delete({ where: { id } });
    return { ok: true };
  }
}
