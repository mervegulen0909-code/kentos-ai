-- Add new channel enum values
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'SMS';

-- Add new citizen identifier source values
ALTER TYPE "CitizenIdentifierSource" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "CitizenIdentifierSource" ADD VALUE IF NOT EXISTS 'FACEBOOK';
ALTER TYPE "CitizenIdentifierSource" ADD VALUE IF NOT EXISTS 'SMS';

-- Outbound delivery state enum
DO $$ BEGIN
  CREATE TYPE "OutboundDeliveryState" AS ENUM ('PENDING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OutboundDelivery table
CREATE TABLE IF NOT EXISTS "OutboundDelivery" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT,
  "channel" "ChannelType" NOT NULL,
  "state" "OutboundDeliveryState" NOT NULL DEFAULT 'PENDING',
  "recipientPhone" TEXT,
  "recipientEmail" TEXT,
  "externalConversationId" TEXT,
  "externalMessageId" TEXT,
  "templateKey" TEXT,
  "body" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboundDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundDelivery_tenantId_channel_state_idx"
  ON "OutboundDelivery" ("tenantId", "channel", "state");
CREATE INDEX IF NOT EXISTS "OutboundDelivery_tenantId_conversationId_idx"
  ON "OutboundDelivery" ("tenantId", "conversationId");

ALTER TABLE "OutboundDelivery"
  ADD CONSTRAINT "OutboundDelivery_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
