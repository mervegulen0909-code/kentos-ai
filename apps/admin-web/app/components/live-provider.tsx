'use client';

import { useCallback, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEventStream } from './use-event-stream';
import type { KentosEvent } from './use-event-stream';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

const statusDot: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: '#22c55e', label: 'Canlı' },
  reconnecting: { color: '#f59e0b', label: 'Bağlanıyor…' },
  disconnected: { color: '#ef4444', label: 'Bağlantı yok' },
};

// List/dashboard pages refresh on any ticket event.
// Individual ticket pages use TicketLiveRefresh for targeted refresh.
const REFRESHABLE_PATHS = ['/', '/queues', '/handoffs', '/reports'];
const TICKET_LIST_ONLY = '/tickets';

function shouldRefresh(pathname: string, event: KentosEvent) {
  if (REFRESHABLE_PATHS.some((p) => pathname === p)) return true;
  // /tickets root list refreshes on ticket.created; not on message/assign (too noisy)
  if (pathname === TICKET_LIST_ONLY && event.type === 'ticket.created') return true;
  return false;
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const liveEnabled = pathname !== '/login';
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');

  const onEvent = useCallback(
    (event: KentosEvent) => {
      // Refresh server components so updated data is fetched automatically.
      // We debounce via requestIdleCallback to avoid thrashing on burst updates.
      if (shouldRefresh(pathname, event)) {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() =>
            router.refresh(),
          );
        } else {
          router.refresh();
        }
      }
    },
    [pathname, router],
  );

  useEventStream({ onEvent, onStatusChange: setStatus, enabled: liveEnabled });

  if (!liveEnabled) return <>{children}</>;

  const dot = statusDot[status];

  return (
    <>
      {children}
      <div
        aria-live="polite"
        aria-label={`Canlı bağlantı: ${dot.label}`}
        title={dot.label}
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: dot.color,
          boxShadow: status === 'connected' ? `0 0 6px ${dot.color}` : 'none',
          transition: 'background-color 0.3s, box-shadow 0.3s',
          zIndex: 9999,
        }}
      />
    </>
  );
}
