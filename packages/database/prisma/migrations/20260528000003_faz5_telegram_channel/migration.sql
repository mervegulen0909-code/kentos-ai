-- FAZ 5.2: Add TELEGRAM to ChannelType enum
-- PostgreSQL requires a special syntax to add enum values
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'TELEGRAM';

-- FAZ 5.3: WhatsApp template definitions (tenant-scoped, synced from Meta API)
CREATE TABLE IF NOT EXISTS "WhatsappTemplate" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "language"    TEXT NOT NULL DEFAULT 'tr',
  "category"    TEXT NOT NULL DEFAULT 'UTILITY',
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "components"  JSONB NOT NULL DEFAULT '[]',
  "metaId"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappTemplate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "WhatsappTemplate"
  ADD CONSTRAINT "WhatsappTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappTemplate_tenantId_name_language_key" ON "WhatsappTemplate"("tenantId", "name", "language");
CREATE INDEX IF NOT EXISTS "WhatsappTemplate_tenantId_idx" ON "WhatsappTemplate"("tenantId");

-- FAZ 5.4: Notification sink configuration (Slack / MS Teams webhooks per tenant)
CREATE TABLE IF NOT EXISTS "NotificationSink" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "type"      TEXT NOT NULL,  -- 'SLACK' | 'TEAMS'
  "webhookUrl" TEXT NOT NULL,
  "events"    JSONB NOT NULL DEFAULT '["ticket.created","ticket.resolved"]',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationSink_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "NotificationSink"
  ADD CONSTRAINT "NotificationSink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "NotificationSink_tenantId_isActive_idx" ON "NotificationSink"("tenantId", "isActive");
