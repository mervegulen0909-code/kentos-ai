-- FAZ 6.2: Zamanlanmış rapor abonelikleri
CREATE TABLE IF NOT EXISTS "ReportSubscription" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "frequency"  TEXT NOT NULL DEFAULT 'WEEKLY',
  "email"      TEXT NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "lastSentAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportSubscription_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ReportSubscription"
  ADD CONSTRAINT "ReportSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ReportSubscription_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "ReportSubscription_tenantId_isActive_idx" ON "ReportSubscription"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "ReportSubscription_userId_idx" ON "ReportSubscription"("userId");
