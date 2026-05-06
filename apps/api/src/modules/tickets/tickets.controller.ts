import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TicketStatus } from '@kentos/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketsService } from './tickets.service.js';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(@Inject(TicketsService) private readonly tickets: TicketsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: TicketStatus,
    @Query('departmentId') departmentId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('q') q?: string,
  ) {
    return this.tickets.list(user, { status, departmentId, categoryId, assignedToId, q });
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user, dto);
  }

  @Get('handoffs')
  listHandoffs(@CurrentUser() user: AuthenticatedUser) {
    return this.tickets.listHandoffs(user);
  }

  @Get('handoffs/:id')
  getHandoff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.getHandoff(user, id);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post('handoffs/:id/create-ticket')
  createTicketFromHandoff(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.createTicketFromHandoff(user, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.get(user, id);
  }

  @Get(':id/audit-log')
  auditLog(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.auditLog(user, id);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post(':id/assign')
  assign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.tickets.assign(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/notes')
  addInternalNote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.addInternalNote(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/public-messages')
  addPublicMessage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.addPublicMessage(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/status')
  updateStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.tickets.updateStatus(user, id, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/request-info')
  requestInfo(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.updateStatus(user, id, { status: TicketStatus.WAITING_INFO, publicMessage: dto.body });
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/resolve')
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.updateStatus(user, id, { status: TicketStatus.RESOLVED, publicMessage: dto.body });
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.updateStatus(user, id, { status: TicketStatus.CLOSED });
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/reject')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.tickets.updateStatus(user, id, { status: TicketStatus.REJECTED, publicMessage: dto.body });
  }
}
