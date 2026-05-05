import { Body, Controller, ForbiddenException, Headers, Inject, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelIntakeEnvelope } from '@kentos/shared';
import { IngestChannelEnvelopeDto } from './dto/ingest-channel-envelope.dto.js';
import { PublicConversationService } from './public-conversation.service.js';

@Controller('internal/channel-ingest')
export class InternalChannelController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PublicConversationService) private readonly conversations: PublicConversationService,
  ) {}

  @Post()
  ingest(@Headers('x-kentos-internal-key') internalKey: string | undefined, @Body() dto: IngestChannelEnvelopeDto) {
    const expected = this.config.get<string>('INTERNAL_API_KEY') ?? 'change-me-internal';
    if (!internalKey || internalKey !== expected) throw new ForbiddenException('Internal kanal anahtari gecersiz.');
    return this.conversations.ingestEnvelope(dto as ChannelIntakeEnvelope);
  }
}
