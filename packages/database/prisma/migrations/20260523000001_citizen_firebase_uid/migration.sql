-- Add Firebase UID to Citizen for Firebase Auth integration
ALTER TABLE "Citizen" ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Citizen_tenantId_firebaseUid_key"
  ON "Citizen"("tenantId", "firebaseUid")
  WHERE "firebaseUid" IS NOT NULL;
