import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { FaqArticlesService } from './faq-articles.service.js';

@ApiBearerAuth()
@ApiTags('faq')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('faq')
export class FaqArticlesController {
  constructor(@Inject(FaqArticlesService) private readonly faq: FaqArticlesService) {}

  @ApiOperation({ summary: 'FAQ makalelerini listele' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('lang') lang?: string,
  ) {
    return this.faq.list(user.tenantId, lang);
  }

  @ApiOperation({ summary: 'FAQ makalesi oluştur' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: { title: string; body: string; slug: string; lang?: string; isPublished?: boolean }) {
    return this.faq.create(user, dto);
  }

  @ApiOperation({ summary: 'FAQ makalesi güncelle' })
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { title?: string; body?: string; slug?: string; lang?: string; isPublished?: boolean },
  ) {
    return this.faq.update(user, id, dto);
  }

  @ApiOperation({ summary: 'FAQ makalesi sil' })
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.faq.remove(user, id);
  }
}
