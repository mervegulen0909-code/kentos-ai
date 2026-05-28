import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3100),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  CITIZEN_SESSION_SECRET: z.string().min(32, 'CITIZEN_SESSION_SECRET must be at least 32 characters'),

  INTERNAL_API_KEY: z.string().min(32, 'INTERNAL_API_KEY must be at least 32 characters').optional(),
  INTERNAL_EVENTS_KEY: z.string().min(32, 'INTERNAL_EVENTS_KEY must be at least 32 characters').optional(),

  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
  AUTH_LOGIN_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),

  CORS_ORIGIN: z.string().optional(),

  REDIS_URL: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
}).refine(
  (env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET,
  { message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values', path: ['JWT_REFRESH_SECRET'] },
);

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }
  return result.data;
}
