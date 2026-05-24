import { Redis, type RedisOptions } from 'ioredis';

const COMMON_DEFAULTS: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
};

/**
 * Merkezi Redis bağlantı factory'si.
 *
 * Tek sunucu: REDIS_URL=redis://localhost:6379
 * Sentinel HA: REDIS_SENTINEL_HOSTS=host1:26379,host2:26379
 *              REDIS_SENTINEL_NAME=mymaster (varsayılan)
 *              REDIS_SENTINEL_PASSWORD=... (opsiyonel)
 *
 * @param overrides - Varsayılan seçenekleri geçersiz kılmak için
 */
export function createRedisClient(overrides: RedisOptions = {}): Redis {
  const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS?.trim();

  if (sentinelHosts) {
    const name = process.env.REDIS_SENTINEL_NAME?.trim() || 'mymaster';
    const sentinelPassword = process.env.REDIS_SENTINEL_PASSWORD?.trim() || undefined;
    const sentinels = sentinelHosts.split(',').map((h) => {
      const parts = h.trim().split(':');
      return { host: parts[0] ?? 'localhost', port: parseInt(parts[1] ?? '26379', 10) };
    });

    return new Redis({
      sentinels,
      name,
      sentinelPassword,
      ...COMMON_DEFAULTS,
      ...overrides,
    });
  }

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { ...COMMON_DEFAULTS, ...overrides });
}

/**
 * BullMQ queue / worker bağlantı nesnesi.
 * Sentinel modunda otomatik olarak sentinel URL dizgisi üretir.
 * `new Queue(name, { connection: redisConnection() })` şeklinde kullanılır.
 */
export function redisConnection(): { url: string } | { sentinels: Array<{ host: string; port: number }>; name: string } {
  const sentinelHosts = process.env.REDIS_SENTINEL_HOSTS?.trim();
  if (sentinelHosts) {
    const name = process.env.REDIS_SENTINEL_NAME?.trim() || 'mymaster';
    const sentinels = sentinelHosts.split(',').map((h) => {
      const parts = h.trim().split(':');
      return { host: parts[0] ?? 'localhost', port: parseInt(parts[1] ?? '26379', 10) };
    });
    return { sentinels, name };
  }
  return { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
}
