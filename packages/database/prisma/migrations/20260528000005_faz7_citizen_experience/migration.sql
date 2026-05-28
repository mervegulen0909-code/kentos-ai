-- FAZ 7.1: Bilgi bankası / FAQ
CREATE TABLE IF NOT EXISTS "FaqArticle" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "lang"        TEXT NOT NULL DEFAULT 'tr',
  "slug"        TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "viewCount"   INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaqArticle_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "FaqArticle"
  ADD CONSTRAINT "FaqArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "FaqArticle_tenantId_slug_lang_key" ON "FaqArticle"("tenantId", "slug", "lang");
CREATE INDEX IF NOT EXISTS "FaqArticle_tenantId_lang_isPublished_idx" ON "FaqArticle"("tenantId", "lang", "isPublished");

-- FAZ 7.2: Randevu sistemi
CREATE TABLE IF NOT EXISTS "AppointmentSlot" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "departmentId" TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3) NOT NULL,
  "capacity"    INT NOT NULL DEFAULT 1,
  "booked"      INT NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AppointmentSlot"
  ADD CONSTRAINT "AppointmentSlot_tenantId_fkey"    FOREIGN KEY ("tenantId")    REFERENCES "Tenant"("id")     ON DELETE CASCADE,
  ADD CONSTRAINT "AppointmentSlot_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "AppointmentSlot_tenantId_startsAt_idx" ON "AppointmentSlot"("tenantId", "startsAt");

CREATE TABLE IF NOT EXISTS "Appointment" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"   TEXT NOT NULL,
  "slotId"     TEXT NOT NULL,
  "citizenId"  TEXT,
  "citizenName" TEXT NOT NULL,
  "citizenPhone" TEXT,
  "note"       TEXT,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | CONFIRMED | CANCELLED | COMPLETED
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Appointment_slotId_fkey"   FOREIGN KEY ("slotId")   REFERENCES "AppointmentSlot"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Appointment_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Appointment_slotId_idx" ON "Appointment"("slotId");
