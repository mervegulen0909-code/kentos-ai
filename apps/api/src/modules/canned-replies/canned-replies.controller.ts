import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CannedRepliesService, CreateCannedReplyDto } from './canned-replies.service.js';

@ApiBearerAuth()
@ApiTags('canned-replies')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('canned-replies')
export class CannedRepliesController {
  constructor(@Inject(CannedRepliesService) private readonly service: CannedRepliesService) {}

  @ApiOperation({ summary: 'Hazır yanıtları listele (paylaşılan + kişisel)' })
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @ApiOperation({ summary: 'Yeni hazır yanıt oluştur' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCannedReplyDto) {
    return this.service.create(user, dto);
  }

  @ApiOperation({ summary: 'Hazır yanıt güncelle' })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: Partial<CreateCannedReplyDto>) {
    return this.service.update(user, id, dto);
  }

  @ApiOperation({ summary: 'Hazır yanıt sil (soft delete)' })
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
