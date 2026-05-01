import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';
import { UpdateMessageTemplateDto } from './dto/message-template.dto.js';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto.js';

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

    if (!tenant) throw new NotFoundException('Belediye bulunamadı.');
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
    return this.prisma.messageTemplate.findMany({ where: { tenantId, isActive: true }, orderBy: { key: 'asc' } });
  }

  createDepartment(tenantId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async updateDepartment(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.requireDepartment(tenantId, id);
    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    if (dto.departmentId) await this.requireDepartment(tenantId, dto.departmentId);
    return this.prisma.category.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        departmentId: dto.departmentId,
        defaultPriority: dto.defaultPriority,
        description: dto.description?.trim(),
      },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(tenantId, id);
    if (dto.departmentId) await this.requireDepartment(tenantId, dto.departmentId);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        departmentId: dto.departmentId,
        defaultPriority: dto.defaultPriority,
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async createSlaPolicy(tenantId: string, dto: CreateSlaPolicyDto) {
    if (dto.departmentId) await this.requireDepartment(tenantId, dto.departmentId);
    if (dto.categoryId) await this.requireCategory(tenantId, dto.categoryId);
    return this.prisma.slaPolicy.create({
      data: {
        tenantId,
        priority: dto.priority,
        responseMinutes: dto.responseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        departmentId: dto.departmentId,
        categoryId: dto.categoryId,
      },
    });
  }

  async updateSlaPolicy(tenantId: string, id: string, dto: UpdateSlaPolicyDto) {
    await this.requireSlaPolicy(tenantId, id);
    return this.prisma.slaPolicy.update({
      where: { id },
      data: {
        responseMinutes: dto.responseMinutes,
        resolutionMinutes: dto.resolutionMinutes,
        isActive: dto.isActive,
      },
    });
  }

  async updateMessageTemplate(tenantId: string, id: string, dto: UpdateMessageTemplateDto) {
    await this.requireMessageTemplate(tenantId, id);
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        body: dto.body,
        isActive: dto.isActive,
      },
    });
  }

  private async requireDepartment(tenantId: string, id: string) {
    const department = await this.prisma.department.findFirst({ where: { tenantId, id } });
    if (!department) throw new NotFoundException('Birim bulunamadı.');
    return department;
  }

  private async requireCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { tenantId, id } });
    if (!category) throw new NotFoundException('Kategori bulunamadı.');
    return category;
  }

  private async requireSlaPolicy(tenantId: string, id: string) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { tenantId, id } });
    if (!policy) throw new NotFoundException('SLA politikası bulunamadı.');
    return policy;
  }

  private async requireMessageTemplate(tenantId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({ where: { tenantId, id } });
    if (!template) throw new NotFoundException('Mesaj şablonu bulunamadı.');
    return template;
  }
}
