type SentryCaptureException = (err: unknown, context?: Record<string, unknown>) => void;

let _capture: SentryCaptureException | undefined;

export async function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return;
  try {
    // Dynamic import so the app boots even if @sentry/node is not installed.
    // Install with: pnpm add @sentry/node --filter @kentos/api
    const Sentry = await import('@sentry/node' as string);
    (Sentry as { init: (opts: object) => void }).init({ dsn, environment, tracesSampleRate: 0.1 });
    _capture = (err, context) =>
      (Sentry as { captureException: (e: unknown, ctx?: object) => void }).captureException(err, context ? { extra: context } : undefined);
  } catch {
    // @sentry/node not installed — silently skip
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  _capture?.(err, context);
}
