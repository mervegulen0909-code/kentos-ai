import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { UpdateAiBudgetSettingsDto } from './dto/ai-budget-settings.dto.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';
import { UpdateMessageTemplateDto } from './dto/message-template.dto.js';
import { UpdateRetentionSettingsDto } from './dto/retention-settings.dto.js';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto } from './dto/sla-policy.dto.js';
import { UpdateWidgetSettingsDto } from './dto/widget-settings.dto.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { TenantsService } from './tenants.service.js';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}

  @Get('tenants/current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.getCurrent(user.tenantId);
  }

  @Get('departments')
  departments(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.departments(user.tenantId);
  }

  @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.categories(user.tenantId);
  }

  @Get('neighborhoods')
  neighborhoods(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.neighborhoods(user.tenantId);
  }

  @Get('sla-policies')
  slaPolicies(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.slaPolicies(user.tenantId);
  }

  @Get('message-templates')
  messageTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.messageTemplates(user.tenantId);
  }

  @Get('widget-settings')
  widgetSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.widgetSettings(user.tenantId);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('widget-settings')
  updateWidgetSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateWidgetSettingsDto) {
    return this.tenants.updateWidgetSettings(user, dto);
  }

  @Get('retention-settings')
  retentionSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.retentionSettings(user.tenantId);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('retention-settings')
  updateRetentionSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateRetentionSettingsDto) {
    return this.tenants.updateRetentionSettings(user, dto);
  }

  @Get('ai-budget-settings')
  aiBudgetSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.aiBudgetSettings(user.tenantId);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('ai-budget-settings')
  updateAiBudgetSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAiBudgetSettingsDto) {
    return this.tenants.updateAiBudgetSettings(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Post('departments')
  createDepartment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartmentDto) {
    return this.tenants.createDepartment(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('departments/:id')
  updateDepartment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.tenants.updateDepartment(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Post('categories')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) {
    return this.tenants.createCategory(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('categories/:id')
  updateCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.tenants.updateCategory(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Post('sla-policies')
  createSlaPolicy(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSlaPolicyDto) {
    return this.tenants.createSlaPolicy(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('sla-policies/:id')
  updateSlaPolicy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSlaPolicyDto) {
    return this.tenants.updateSlaPolicy(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN')
  @Patch('message-templates/:id')
  updateMessageTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.tenants.updateMessageTemplate(user, id, dto);
  }
}
