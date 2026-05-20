/**
 * Basit yapılandırılmış (structured) JSON logger.
 * NODE_ENV=production → JSON satır formatı (log toplayıcı dostu)
 * Diğer → okunabilir text formatı
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const isProduction = process.env.NODE_ENV === 'production';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (isProduction) {
    process.stdout.write(
      JSON.stringify({ ts, level, service: 'whatsapp-gateway', message, ...context }) + '\n',
    );
  } else {
    const prefix = `[${ts}] [${level.toUpperCase()}]`;
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    // eslint-disable-next-line no-console
    (level === 'error' || level === 'warn' ? console.error : console.log)(`${prefix} ${message}${ctx}`);
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
};
