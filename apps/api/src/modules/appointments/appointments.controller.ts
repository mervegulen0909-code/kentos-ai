import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { AppointmentsService } from './appointments.service.js';

@ApiBearerAuth()
@ApiTags('appointments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER')
@Controller('appointments')
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private readonly svc: AppointmentsService) {}

  // --- Slot management ---

  @ApiOperation({ summary: 'Randevu slotlarını listele' })
  @Get('slots')
  listSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listSlots(user.tenantId, from, to);
  }

  @ApiOperation({ summary: 'Randevu slotu oluştur' })
  @Post('slots')
  createSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { departmentId?: string; startsAt: string; endsAt: string; capacity?: number },
  ) {
    return this.svc.createSlot(user, dto);
  }

  @ApiOperation({ summary: 'Randevu slotu sil' })
  @Delete('slots/:id')
  deleteSlot(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.deleteSlot(user, id);
  }

  // --- Appointment management ---

  @ApiOperation({ summary: 'Randevuları listele' })
  @Get()
  listAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.svc.listAppointments(user, status);
  }

  @ApiOperation({ summary: 'Randevu durumunu güncelle' })
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateAppointmentStatus(user, id, status);
  }
}
