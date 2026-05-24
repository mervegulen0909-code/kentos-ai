import { timingSafeEqual, createHash } from 'node:crypto';
import { Body, Controller, ForbiddenException, Inject, MessageEvent, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { KentosEvent } from './events.service.js';
import { EventsService } from './events.service.js';

@ApiBearerAuth()
@ApiTags('events')
@Controller('events')
export class EventsController {
  private readonly internalKey: string;

  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    this.internalKey = this.config.get<string>('INTERNAL_EVENTS_KEY') ?? 'kentos-internal-dev';
  }

  @ApiOperation({
    summary: 'SSE global event stream — tenant scope',
    description:
      'Connects an SSE stream filtered to the authenticated user\'s tenant. ' +
      'Emits ticket.created, ticket.updated, ticket.assigned, ticket.message_added, ' +
      'sla.breached, delivery.dispatched. Heartbeat every 15 s.',
  })
  @UseGuards(AuthGuard('jwt'))
  @Sse('stream')
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    // Heartbeat prevents proxy/load-balancer idle-timeout disconnects.
    const heartbeat$ = interval(15_000).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat' }) } as MessageEvent)),
    );

    const events$ = this.events.stream(user.tenantId).pipe(
      map((event) => ({ data: JSON.stringify(event) } as MessageEvent)),
    );

    return merge(heartbeat$, events$);
  }

  // Internal endpoint used by workers/processors to push events into the SSE bus.
  // Protected by a shared secret (INTERNAL_EVENTS_KEY env var), not JWT.
  @ApiExcludeEndpoint()
  @Post('internal/emit')
  internalEmit(@Body() body: { key: string; event: KentosEvent }) {
    const expected = createHash('sha256').update(this.internalKey).digest();
    const given = createHash('sha256').update(body.key ?? '').digest();
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new ForbiddenException();
    }
    this.events.emit(body.event);
    return { ok: true };
  }
}
