import { Redis, type RedisOptions } from 'ioredis';

/**
 * Merkezi Redis bağlantı factory'si.
 *
 * Tüm ioredis `new Redis(...)` çağrıları buradan yapılmalı.
 * İleride Sentinel / TLS / password-rotation eklemek için tek yer burası.
 *
 * @param overrides - Varsayılan seçenekleri geçersiz kılmak için
 */
export function createRedisClient(overrides: RedisOptions = {}): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    ...overrides,
  });
}

/**
 * BullMQ queue / worker bağlantı nesnesi.
 * `new Queue(name, { connection: redisConnection() })` şeklinde kullanılır.
 */
export function redisConnection(): { url: string } {
  return { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
}
