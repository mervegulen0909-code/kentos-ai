'use client';

import { useEffect, useRef, useCallback } from 'react';

export type KentosEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.message_added'
  | 'sla.breached'
  | 'delivery.dispatched'
  | 'heartbeat';

export type KentosEvent = {
  type: KentosEventType;
  tenantId: string;
  payload: Record<string, unknown>;
};

type UseEventStreamOptions = {
  onEvent: (event: KentosEvent) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  enabled?: boolean;
};

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export function useEventStream({ onEvent, onStatusChange, enabled = true }: UseEventStreamOptions) {
  const esRef = useRef<EventSource | null>(null);
  const retryMs = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const onStatusRef = useRef(onStatusChange);

  // Keep refs in sync so stale closures don't cause issues
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onStatusRef.current = onStatusChange; }, [onStatusChange]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const es = new EventSource('/api/events/stream');
    esRef.current = es;

    es.onopen = () => {
      retryMs.current = INITIAL_RETRY_MS;
      onStatusRef.current?.('connected');
    };

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as KentosEvent;
        if (event.type !== 'heartbeat') {
          onEventRef.current(event);
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      onStatusRef.current?.('reconnecting');
      retryTimer.current = setTimeout(() => {
        retryMs.current = Math.min(retryMs.current * 2, MAX_RETRY_MS);
        connect();
      }, retryMs.current);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      esRef.current?.close();
      esRef.current = null;
      onStatusRef.current?.('disconnected');
    };
  }, [enabled, connect]);
}
