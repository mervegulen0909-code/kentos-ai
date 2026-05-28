-- FAZ 2.2: KVKK rıza sürüm takibi
CREATE TABLE IF NOT EXISTS "KvkkConsentVersion" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT NOT NULL,
  "version"    TEXT NOT NULL,
  "summary"    TEXT NOT NULL,
  "contentUrl" TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KvkkConsentVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KvkkConsentVersion"
  ADD CONSTRAINT "KvkkConsentVersion_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "KvkkConsentVersion_tenantId_version_key"
  ON "KvkkConsentVersion"("tenantId", "version");

CREATE INDEX IF NOT EXISTS "KvkkConsentVersion_tenantId_isActive_idx"
  ON "KvkkConsentVersion"("tenantId", "isActive");

-- FAZ 2.2: Citizen.kvkkConsentVersionId
ALTER TABLE "Citizen"
  ADD COLUMN IF NOT EXISTS "kvkkConsentVersionId" TEXT,
  ADD CONSTRAINT "Citizen_kvkkConsentVersionId_fkey"
  FOREIGN KEY ("kvkkConsentVersionId") REFERENCES "KvkkConsentVersion"("id") ON DELETE SET NULL;

-- FAZ 2.3: 2FA/TOTP fields on User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpSecret"  TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
