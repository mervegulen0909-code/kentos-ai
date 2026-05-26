'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEventStream } from './use-event-stream';
import type { KentosEvent } from './use-event-stream';

const TICKET_EVENTS: ReadonlySet<string> = new Set([
  'ticket.updated',
  'ticket.assigned',
  'ticket.message_added',
]);

/**
 * Mounts an SSE listener scoped to a single ticket.
 * Calls router.refresh() only when the incoming event targets this ticketId.
 * This lets the ticket detail page stay live without full-page polling.
 */
export function TicketLiveRefresh({ ticketId }: { ticketId: string }) {
  const router = useRouter();

  const onEvent = useCallback(
    (event: KentosEvent) => {
      if (
        TICKET_EVENTS.has(event.type) &&
        event.payload.ticketId === ticketId
      ) {
        router.refresh();
      }
    },
    [ticketId, router],
  );

  useEventStream({ onEvent });

  return null;
}
