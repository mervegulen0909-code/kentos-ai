/** Merkezi BullMQ Redis bağlantı config — tek noktadan yönetim. */
export function redisConnection(): { url: string } {
  return { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
}
