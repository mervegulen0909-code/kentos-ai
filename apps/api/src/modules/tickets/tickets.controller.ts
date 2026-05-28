import { Body, Controller, Delete, Get, Inject, MessageEvent, Param, Patch, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable, interval, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TicketStatus } from '@kentos/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { BulkAssignDto } from './dto/bulk-assign.dto.js';
import { BulkStatusDto } from './dto/bulk-status.dto.js';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ScheduleMessageDto } from './dto/schedule-message.dto.js';
import { SuggestReplyDto } from './dto/suggest-reply.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiBearerAuth()
@ApiTags('tickets')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(@Inject(TicketsService) private readonly tickets: TicketsService) {}

  @ApiOperation({ summary: 'SSE stream — ticket durum değişikliği olayları' })
  @Sse(':id/events')
  ticketEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Observable<MessageEvent> {
    // Poll every 5 seconds for ticket updates
    return interval(5000).pipe(
      switchMap(() => from(this.tickets.get(user, id))),
      map((ticket) => ({ data: JSON.stringify({ type: 'ticket.updated', ticket }) } as MessageEvent)),
      catchError((err: { status?: number }) => {
        const type = err?.status === 404 ? 'ticket.not_found' : 'stream.error';
        return of({ data: JSON.stringify({ type }) } as MessageEvent);
      }),
    );
  }

  @ApiOperation({ summary: 'Ticket listesi (sayfalı, filtrelenebilir)' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'assignedToId', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Serbest metin arama' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Ticket listesi ve sayfalama meta' })
  @ApiResponse({ status: 401, description: 'Kimlik doğrulama gerekli' })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: TicketStatus,
    @Query('departmentId') departmentId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tickets.list(user, {
      status, departmentId, categoryId, assignedToId, q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiOperation({ summary: 'Yeni ticket oluştur' })
  @ApiResponse({ status: 201, description: 'Ticket oluşturuldu' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.tickets.create(user, dto);
  }

  @ApiOperation({ summary: 'WhatsApp handoff listesi' })
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

  @ApiOperation({ summary: 'Ticket detayı' })
  @ApiResponse({ status: 404, description: 'Ticket bulunamadı' })
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

  @ApiOperation({ summary: 'AI yanıt önerisi — operatör için otomatik taslak üretir' })
  @ApiResponse({ status: 200, description: 'Öneri metni, model adı ve token kullanımı' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/suggest-reply')
  suggestReply(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SuggestReplyDto) {
    return this.tickets.suggestReply(user, id, dto);
  }

  // 4.1 — AI ticket özetleme
  @ApiOperation({ summary: 'AI ticket özeti' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/summarize')
  summarize(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.summarize(user, id);
  }

  // 4.2 — Follow-up tespiti
  @ApiOperation({ summary: 'Otomatik follow-up tespiti (WAITING_INFO durumu kontrolü)' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/evaluate-follow-up')
  evaluateFollowUp(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.evaluateFollowUp(user, id);
  }

  // 4.3 — Sentiment analizi
  @ApiOperation({ summary: 'Vatandaş mesajı sentiment analizi' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/analyze-sentiment')
  analyzeSentiment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.analyzeSentiment(user, id);
  }

  @ApiOperation({ summary: 'Akıllı otomatik atama — en az yüklü operatörü atar' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post(':id/smart-assign')
  smartAssign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.smartAssign(user, id);
  }

  @ApiOperation({ summary: 'AI öncelik önerisi — ticket içeriğine göre öncelik tahmin eder' })
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/suggest-priority')
  suggestPriority(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.suggestPriority(user, id);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post('bulk-assign')
  @ApiOperation({ summary: 'Toplu atama (max 50 ticket)' })
  bulkAssign(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkAssignDto) {
    return this.tickets.bulkAssign(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post('bulk-status')
  @ApiOperation({ summary: 'Toplu durum güncelleme (max 50 ticket)' })
  bulkUpdateStatus(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkStatusDto) {
    return this.tickets.bulkUpdateStatus(user, dto);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'OPERATOR')
  @Post(':id/schedule-message')
  @ApiOperation({ summary: 'Zamanlanmış mesaj gönder' })
  scheduleMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ScheduleMessageDto,
  ) {
    return this.tickets.scheduleMessage(user, id, dto);
  }

  // 3.2 — Tags
  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Post(':id/tags/:tagId')
  @ApiOperation({ summary: 'Ticket\'a etiket ekle' })
  attachTag(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.tickets.attachTag(user, id, tagId);
  }

  @Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'DEPARTMENT_STAFF', 'OPERATOR')
  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Ticket\'dan etiket kaldır' })
  detachTag(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('tagId') tagId: string) {
    return this.tickets.detachTag(user, id, tagId);
  }

  // 3.4 — Watchers
  @Post(':id/watch')
  @ApiOperation({ summary: 'Ticket\'ı takip et' })
  watchTicket(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.watchTicket(user, id);
  }

  @Delete(':id/watch')
  @ApiOperation({ summary: 'Ticket takibini bırak' })
  unwatchTicket(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.unwatchTicket(user, id);
  }

  @Get(':id/watchers')
  @ApiOperation({ summary: 'Ticket takipçilerini listele' })
  listWatchers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.listWatchers(user, id);
  }

  // 3.5 — Checklist
  @Get(':id/checklist')
  @ApiOperation({ summary: 'Kontrol listesini getir' })
  listChecklist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tickets.listChecklist(user, id);
  }

  @Post(':id/checklist')
  @ApiOperation({ summary: 'Kontrol listesine öge ekle' })
  addChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { title: string; position?: number },
  ) {
    return this.tickets.addChecklistItem(user, id, dto);
  }

  @Patch(':id/checklist/:itemId')
  @ApiOperation({ summary: 'Kontrol listesi ögesini güncelle' })
  updateChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: { title?: string; position?: number },
  ) {
    return this.tickets.updateChecklistItem(user, id, itemId, dto);
  }

  @Post(':id/checklist/:itemId/toggle')
  @ApiOperation({ summary: 'Kontrol listesi ögesini tamamla / geri al' })
  toggleChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tickets.toggleChecklistItem(user, id, itemId);
  }

  @Delete(':id/checklist/:itemId')
  @ApiOperation({ summary: 'Kontrol listesi ögesini sil' })
  removeChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tickets.removeChecklistItem(user, id, itemId);
  }
}
