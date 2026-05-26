import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PublicChannelGuard } from '../../common/guards/public-channel.guard.js';
import { CitizensService } from '../citizens/citizens.service.js';
import { CitizenSessionService } from './citizen-session.service.js';

class CitizenErasureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  sessionToken!: string;
}

@ApiTags('public')
@UseGuards(PublicChannelGuard)
@Throttle({ default: { ttl: 60_000, limit: 5 } }) // max 5 erasure attempts / minute
@Controller('public/:tenantSlug/citizen')
export class PublicCitizenErasureController {
  constructor(
    @Inject(CitizensService) private readonly citizens: CitizensService,
    @Inject(CitizenSessionService) private readonly sessions: CitizenSessionService,
  ) {}

  @Post('erasure')
  @ApiOperation({ summary: 'Citizen self-service data erasure (KVKK silme hakki)' })
  async requestErasure(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CitizenErasureDto,
  ) {
    const session = this.sessions.verify(dto.sessionToken, tenantSlug);
    return this.citizens.selfErase(session.tenantId, session.citizenId);
  }
}
