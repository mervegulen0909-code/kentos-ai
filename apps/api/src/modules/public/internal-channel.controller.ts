import { BadRequestException, Body, Controller, ForbiddenException, Headers, Inject, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { channelIntakeEnvelopeSchema } from '@kentos/shared';
import { IngestChannelEnvelopeDto } from './dto/ingest-channel-envelope.dto.js';
import { PublicConversationService } from './public-conversation.service.js';

@SkipThrottle() // Servis-içi iletişim — kendi auth'u (x-kentos-internal-key) var
@Controller('internal/channel-ingest')
export class InternalChannelController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PublicConversationService) private readonly conversations: PublicConversationService,
  ) {}

  @Post()
  ingest(@Headers('x-kentos-internal-key') internalKey: string | undefined, @Body() dto: IngestChannelEnvelopeDto) {
    const expected = this.resolveInternalApiKey();
    if (!internalKey || internalKey !== expected) throw new ForbiddenException('Internal kanal anahtari gecersiz.');
    const parsed = channelIntakeEnvelopeSchema.safeParse(dto);
    if (!parsed.success) throw new BadRequestException('Internal kanal zarfi gecersiz.');
    return this.conversations.ingestEnvelope(parsed.data);
  }

  private resolveInternalApiKey() {
    const configured = this.config.get<string>('INTERNAL_API_KEY');
    if (configured) {
      if (this.config.get<string>('NODE_ENV') === 'production' && configured === 'change-me-internal') {
        throw new ForbiddenException('Internal kanal anahtari production icin yapilandirilmadi.');
      }
      return configured;
    }

    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Internal kanal anahtari yapilandirilmadi.');
    }
    return 'change-me-internal';
  }
}
