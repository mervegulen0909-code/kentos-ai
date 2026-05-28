import { BadRequestException, Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
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

const CITIZEN_ERASURE_THROTTLE_TTL_MS = Number(process.env.CITIZEN_ERASURE_THROTTLE_TTL_MS ?? 3_600_000);
const IS_QA_STACK = process.env.PORT === '3110' && process.env.DATABASE_URL?.includes('kentos_ai_qa');
const CITIZEN_ERASURE_THROTTLE_LIMIT = Number(process.env.CITIZEN_ERASURE_THROTTLE_LIMIT ?? (IS_QA_STACK ? 10 : 1));

@ApiTags('public')
@UseGuards(PublicChannelGuard)
@Throttle({ default: { ttl: CITIZEN_ERASURE_THROTTLE_TTL_MS, limit: CITIZEN_ERASURE_THROTTLE_LIMIT } })
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
    if (!dto.sessionToken || typeof dto.sessionToken !== 'string') {
      throw new BadRequestException('sessionToken is required.');
    }

    const session = this.sessions.verify(dto.sessionToken, tenantSlug);
    return this.citizens.selfErase(session.tenantId, session.citizenId);
  }
}
