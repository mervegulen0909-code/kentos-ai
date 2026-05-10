-- AiRun telemetry (W3.4)
-- Forward-only. Existing rows default success=true; legacy runs without token data
-- continue to count as zero-cost zero-token records.
ALTER TABLE "AiRun"
  ADD COLUMN "tokensInput" INTEGER,
  ADD COLUMN "tokensOutput" INTEGER,
  ADD COLUMN "tokensTotal" INTEGER,
  ADD COLUMN "costMicros" INTEGER,
  ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "errorReason" TEXT;

CREATE INDEX "AiRun_tenantId_createdAt_idx" ON "AiRun"("tenantId", "createdAt");
