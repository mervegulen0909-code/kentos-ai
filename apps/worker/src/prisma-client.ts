import { PrismaClient } from '@kentos/database';

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export async function disconnectPrismaClient() {
  if (client) {
    await client.$disconnect().catch(() => {});
    client = null;
  }
}
