import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@kentos/database';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator.js';
import { CitizensService } from './citizens.service.js';
import { MergeCitizenDto } from './dto/merge-citizen.dto.js';

@ApiBearerAuth()
@ApiTags('citizens')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
@Controller('citizens')
export class CitizensController {
  constructor(
    @Inject(CitizensService) private readonly citizens: CitizensService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List citizens (tenant-scoped, paginated)' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search by name, phone, or email' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.citizens.list(user, {
      q,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single citizen with recent tickets and identifiers' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.citizens.get(user, id);
  }

  @Post(':id/merge')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Merge a duplicate citizen into another citizen' })
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MergeCitizenDto,
  ) {
    return this.citizens.merge(user, id, dto);
  }

  @Post(':id/anonymize')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Anonymize a citizen (GDPR erasure)' })
  anonymize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.citizens.anonymize(user, id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export all citizen data as structured JSON (GDPR portability)' })
  export(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.citizens.export(user, id);
  }
}
