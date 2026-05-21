export async function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node' as string);
    (Sentry as { init: (opts: object) => void }).init({ dsn, environment, tracesSampleRate: 0.1 });
  } catch {
    // @sentry/node not installed — silently skip
  }
}
