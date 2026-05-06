-- CreateEnum
CREATE TYPE "CitizenIdentifierKind" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "CitizenIdentifierSource" AS ENUM ('PUBLIC_WEB', 'WEB_CHAT', 'WHATSAPP', 'STAFF', 'IMPORT', 'MERGE');

-- AlterTable
ALTER TABLE "Citizen" ADD COLUMN "mergedIntoCitizenId" TEXT;
ALTER TABLE "Citizen" ADD COLUMN "mergedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CitizenIdentifier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "kind" "CitizenIdentifierKind" NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "source" "CitizenIdentifierSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Citizen_tenantId_mergedIntoCitizenId_idx" ON "Citizen"("tenantId", "mergedIntoCitizenId");

-- CreateIndex
CREATE INDEX "CitizenIdentifier_tenantId_citizenId_kind_idx" ON "CitizenIdentifier"("tenantId", "citizenId", "kind");

-- CreateIndex
CREATE INDEX "CitizenIdentifier_tenantId_kind_isPrimary_idx" ON "CitizenIdentifier"("tenantId", "kind", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenIdentifier_tenantId_kind_normalizedValue_key" ON "CitizenIdentifier"("tenantId", "kind", "normalizedValue");

-- AddForeignKey
ALTER TABLE "Citizen" ADD CONSTRAINT "Citizen_mergedIntoCitizenId_fkey" FOREIGN KEY ("mergedIntoCitizenId") REFERENCES "Citizen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenIdentifier" ADD CONSTRAINT "CitizenIdentifier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenIdentifier" ADD CONSTRAINT "CitizenIdentifier_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
