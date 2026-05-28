-- FAZ 8.0: TWITTER enum değeri ekle
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'TWITTER';

-- FAZ 8.1: Semantik duplicate tespiti için pgvector
-- pgvector eklentisi önce yüklü olmalı (superuser):
--   CREATE EXTENSION IF NOT EXISTS vector;
-- Bu migration'da embedding sütunu TEXT olarak saklanır;
-- pgvector aktifleştirildiğinde aşağıdaki ALTER çalıştırılabilir:
--   ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
--   CREATE INDEX IF NOT EXISTS ticket_embedding_idx ON "Ticket" USING ivfflat ("embedding" vector_cosine_ops);
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "embeddingJson" TEXT;

-- FAZ 8.4: X (Twitter) sosyal medya izleme — izleme kuralları
CREATE TABLE IF NOT EXISTS "SocialMonitorRule" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "platform"    TEXT NOT NULL DEFAULT 'TWITTER',  -- TWITTER | INSTAGRAM
  "query"       TEXT NOT NULL,                     -- "#belediye OR @handle"
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastChecked" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialMonitorRule_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SocialMonitorRule"
  ADD CONSTRAINT "SocialMonitorRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "SocialMonitorRule_tenantId_isActive_idx" ON "SocialMonitorRule"("tenantId", "isActive");

-- FAZ 8.3: IVR çağrı kayıtları
CREATE TABLE IF NOT EXISTS "IvrCall" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "callSid"      TEXT NOT NULL,
  "from"         TEXT NOT NULL,
  "to"           TEXT NOT NULL,
  "transcript"   TEXT,
  "ticketId"     TEXT,
  "status"       TEXT NOT NULL DEFAULT 'INITIATED',  -- INITIATED | TRANSCRIBED | TICKET_CREATED | FAILED
  "recordingUrl" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IvrCall_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "IvrCall"
  ADD CONSTRAINT "IvrCall_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "IvrCall_callSid_key" ON "IvrCall"("callSid");
CREATE INDEX IF NOT EXISTS "IvrCall_tenantId_status_idx" ON "IvrCall"("tenantId", "status");
