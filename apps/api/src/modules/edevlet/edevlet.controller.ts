import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EdevletService } from './edevlet.service.js';

@ApiTags('e-devlet')
@Controller('public/edevlet')
export class EdevletController {
  constructor(private readonly edevlet: EdevletService) {}

  @ApiOperation({ summary: 'TC Kimlik No ile vatandaş doğrulama (KPS)' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('verify')
  verify(@Body() dto: { tckn: string; firstName: string; lastName: string; birthYear: number }) {
    return this.edevlet.verifyIdentity(dto);
  }
}
