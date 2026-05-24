import { NextResponse } from 'next/server';
import { resolveAdminSession } from '../../../../lib/session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3100/api/v1';

/**
 * GET /api/events/stream
 *
 * Server-side proxy that reads the httpOnly JWT cookie and forwards the SSE
 * stream from the NestJS API to the browser. This keeps the access token out
 * of client-side JavaScript entirely.
 */
export async function GET() {
  const session = await resolveAdminSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${API_BASE_URL}/events/stream`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Stream unavailable' }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const dynamic = 'force-dynamic';
