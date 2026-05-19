import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CitizensService } from './citizens.service.js';
import { MergeCitizenDto } from './dto/merge-citizen.dto.js';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('citizens')
export class CitizensController {
  constructor(@Inject(CitizensService) private readonly citizens: CitizensService) {}

  @Post(':id/merge')
  @Roles('TENANT_ADMIN')
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MergeCitizenDto,
  ) {
    return this.citizens.merge(user, id, dto);
  }
}
