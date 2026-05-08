import { AuditActorType, type Prisma } from '@kentos/database';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';
import { UpdateMessageTemplateDto } from './dto/message-template.dto.js';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto.js';
import { UpdateWidgetSettingsDto } from './dto/widget-settings.dto.js';

@Injectable()
export class TenantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        departments: { where: { isActive: true }, orderBy: { name: 'asc' } },
        categories: { where: { isActive: true }, orderBy: { name: 'asc' } },
        neighborhoods: { where: { isActive: true }, orderBy: { name: 'asc' } },
        slaPolicies: { where: { isActive: true }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] },
        messageTemplates: { where: { isActive: true }, orderBy: { key: 'asc' } },
      },
    });

    if (!tenant) throw new NotFoundException('Belediye bulunamadi.');
    return tenant;
  }

  departments(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  categories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenantId, isActive: true },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  neighborhoods(tenantId: string) {
    return this.prisma.neighborhood.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } });
  }

  slaPolicies(tenantId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { tenantId, isActive: true },
      include: { department: true, category: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  messageTemplates(tenantId: string) {
    return this.prisma.messageTemplate.findMany({ where: { tenantId }, orderBy: { key: 'asc' } });
  }

  async widgetSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        slug: true,
        widgetEnabled: true,
        widgetTitle: true,
        widgetWelcome: true,
        widgetAllowedOrigins: true,
      },
    });
    if (!tenant) throw new NotFoundException('Belediye bulunamadi.');

    return {
      tenantSlug: tenant.slug,
      widgetEnabled: tenant.widgetEnabled,
      widgetTitle: tenant.widgetTitle,
      widgetWelcome: tenant.widgetWelcome,
      widgetAllowedOrigins: this.readOriginList(tenant.widgetAllowedOrigins),
    };
  }

  async updateWidgetSettings(user: AuthenticatedUser, dto: UpdateWidgetSettingsDto) {
    const before = await this.widgetSettings(user.tenantId);
    const tenant = await this.prisma.tenant.update({
      where: { id: user.tenantId },
      data: {
        widgetEnabled: dto.widgetEnabled,
        widgetTitle: dto.widgetTitle?.trim(),
        widgetWelcome: dto.widgetWelcome?.trim(),
        widgetAllowedOrigins: dto.widgetAllowedOrigins,
      },
      select: {
        slug: true,
        widgetEnabled: true,
        widgetTitle: true,
        widgetWelcome: true,
        widgetAllowedOrigins: true,
      },
    });
    const after = {
      tenantSlug: tenant.slug,
      widgetEnabled: tenant.widgetEnabled,
      widgetTitle: tenant.widgetTitle,
      widgetWelcome: tenant.widgetWelcome,
      widgetAllowedOrigins: this.readOriginList(tenant.widgetAllowedOrigins),
    };

    await this.audit(user, 'tenant.widget_settings_updated', before, after);
    return after;
  }

  async createDepartment(user: AuthenticatedUser, dto: CreateDepartmentDto) {
    const department = await this.prisma.department.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });

    await this.audit(user, 'tenant.department_created', undefined, {
      departmentId: department.id,
      code: department.code,
      name: department.name,
      description: department.description,
    });

    return department;
  }

  async updateDepartment(user: AuthenticatedUser, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.requireDepartment(user.tenantId, id);
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.audit(
      user,
      'tenant.department_updated',
      {
        departmentId: existing.id,
        name: existing.name,
        description: existing.description,
        isActive: existing.isActive,
      },
      {
        departmentId: department.id,
        name: department.name,
        description: department.description,
        isActive: department.isActive,
      },
    );

    return department;
  }

  async createCategory(user: AuthenticatedUser, dto: CreateCategoryDto) {
    if (dto.departmentId) await this.requireDepartment(user.tenantId, dto.departmentId);
    const category = await this.prisma.category.create({
      data: {
        tenantId: user.tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        departmentId: dto.departmentId,
        defaultPriority: dto.defaultPriority,
        description: dto.description?.trim(),
      },
    });

    await this.audit(user, 'tenant.category_created', undefined, {
      categoryId: category.id,
      code: category.code,
      name: category.name,
      departmentId: category.departmentId,
      defaultPriority: category.defaultPriority,
    });

    return category;
  }

  async updateCategory(user: AuthenticatedUser, id: string, dto: UpdateCategoryDto) {
    const existing = await this.requireCategory(user.tenantId, id);
    if (dto.departmentId) await this.requireDepartment(user.tenantId, dto.departmentId);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        departmentId: dto.departmentId,
        defaultPriority: dto.defaultPriority,
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });

    await this.audit(
      user,
      'tenant.category_updated',
      {
        categoryId: existing.id,
        name: existing.name,
        departmentId: existing.departmentId,
        defaultPriority: existing.defaultPriority,
        description: existing.description,
        isActive: existing.isActive,
      },
      {
        categoryId: category.id,
        name: category.name,
        departmentId: category.departmentId,
        defaultPriority: category.defaultPriority,
        description: category.description,
        isActive: category.isActive,
      },
    );

    return category;
  }

  async createSlaPolicy(user: AuthenticatedUser, dto: CreateSlaPolicyDto) {
    if (dto.departmentId) await this.requireDepartment(user.tenantId, dto.departmentId);
    if (dto.categoryId) await this.requireCategory(user.tenantId, dto.categoryId);
    const policy = await this.prisma.slaPolicy.create({
      data: {
        tenantId: user.tenantId,
        priority: dto.priority,
        responseMinutes: dto.responseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
      },
    });

    await this.audit(user, 'tenant.sla_policy_created', undefined, {
      slaPolicyId: policy.id,
      priority: policy.priority,
      responseMinutes: policy.responseMinutes,
      resolutionMinutes: policy.resolutionMinutes,
      departmentId: policy.departmentId,
      categoryId: policy.categoryId,
    });

    return policy;
  }

  async updateSlaPolicy(user: AuthenticatedUser, id: string, dto: UpdateSlaPolicyDto) {
    const existing = await this.requireSlaPolicy(user.tenantId, id);
    const policy = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        responseMinutes: dto.responseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        isActive: dto.isActive,
      },
    });

    await this.audit(
      user,
      'tenant.sla_policy_updated',
      {
        slaPolicyId: existing.id,
        responseMinutes: existing.responseMinutes,
        resolutionMinutes: existing.resolutionMinutes,
        isActive: existing.isActive,
      },
      {
        slaPolicyId: policy.id,
        responseMinutes: policy.responseMinutes,
        resolutionMinutes: policy.resolutionMinutes,
        isActive: policy.isActive,
      },
    );

    return policy;
  }

  async updateMessageTemplate(user: AuthenticatedUser, id: string, dto: UpdateMessageTemplateDto) {
    const existing = await this.requireMessageTemplate(user.tenantId, id);
    const template = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        body: dto.body,
        isActive: dto.isActive,
        ...(dto.channel === undefined ? {} : { channel: dto.channel ?? null }),
      },
    });

    await this.audit(
      user,
      'tenant.message_template_updated',
      {
        messageTemplateId: existing.id,
        key: existing.key,
        body: existing.body,
        isActive: existing.isActive,
        channel: existing.channel,
      },
      {
        messageTemplateId: template.id,
        key: template.key,
        body: template.body,
        isActive: template.isActive,
        channel: template.channel,
      },
    );

    return template;
  }

  private readOriginList(value: unknown) {
    return Array.isArray(value) ? value.map((origin) => String(origin)).filter(Boolean) : [];
  }

  private async requireDepartment(tenantId: string, id: string) {
    const department = await this.prisma.department.findFirst({ where: { tenantId, id } });
    if (!department) throw new NotFoundException('Birim bulunamadi.');
    return department;
  }

  private async requireCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Kategori bulunamadi.');
    return category;
  }

  private async requireSlaPolicy(tenantId: string, id: string) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { tenantId, id } });
    if (!policy) throw new NotFoundException('SLA politikasi bulunamadi.');
    return policy;
  }

  private async requireMessageTemplate(tenantId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({ where: { tenantId, id } });
    if (!template) throw new NotFoundException('Mesaj sablonu bulunamadi.');
    return template;
  }

  private audit(user: AuthenticatedUser, action: string, before?: Prisma.InputJsonValue, after?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        action,
        before,
        after,
      },
    });
  }
}
