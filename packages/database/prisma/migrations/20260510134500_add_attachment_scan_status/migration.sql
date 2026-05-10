-- Attachment virus scan status (W3.3)
-- Forward-only. Existing rows default to PENDING; scan provider stays null until a real scan completes.
CREATE TYPE "AttachmentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'SKIPPED');

ALTER TABLE "Attachment"
  ADD COLUMN "scanStatus" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scanProvider" TEXT,
  ADD COLUMN "scanThreat" TEXT,
  ADD COLUMN "scanResult" JSONB,
  ADD COLUMN "scannedAt" TIMESTAMP(3);

CREATE INDEX "Attachment_tenantId_scanStatus_idx" ON "Attachment"("tenantId", "scanStatus");
