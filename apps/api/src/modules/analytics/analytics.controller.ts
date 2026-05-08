import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AnalyticsService } from './analytics.service.js';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.overview(user);
  }

  @Get('departments')
  departments(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.departments(user);
  }

  @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.categories(user);
  }

  @Get('neighborhoods')
  neighborhoods(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.neighborhoods(user);
  }

  @Get('channels')
  channels(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.channels(user);
  }

  @Get('conversation-segments')
  conversationSegments(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.conversationSegments(user);
  }
}
