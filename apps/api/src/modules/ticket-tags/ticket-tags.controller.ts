import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CreateTagDto, TicketTagsService } from './ticket-tags.service.js';

@ApiBearerAuth()
@ApiTags('ticket-tags')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('ticket-tags')
export class TicketTagsController {
  constructor(@Inject(TicketTagsService) private readonly service: TicketTagsService) {}

  @ApiOperation({ summary: 'Etiketleri listele' })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @ApiOperation({ summary: 'Yeni etiket oluştur' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTagDto) {
    return this.service.create(user, dto);
  }

  @ApiOperation({ summary: 'Etiket güncelle' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: Partial<CreateTagDto>) {
    return this.service.update(user, id, dto);
  }

  @ApiOperation({ summary: 'Etiket sil' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
