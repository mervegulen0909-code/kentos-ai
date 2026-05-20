-- B4: WhatsApp template fields on MessageTemplate
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappTemplateId" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappTemplateName" TEXT;

-- C1: CSAT fields on Ticket
ALTER TABLE "Ticket" ADD COLUMN "csatScore" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "csatRespondedAt" TIMESTAMP(3);

-- C2: TenantWebhook model
CREATE TABLE "TenantWebhook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantWebhook_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TenantWebhook" ADD CONSTRAINT "TenantWebhook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TenantWebhook_tenantId_isActive_idx" ON "TenantWebhook"("tenantId", "isActive");

-- C3: CitizenDeviceToken model
CREATE TABLE "CitizenDeviceToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CitizenDeviceToken_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CitizenDeviceToken" ADD CONSTRAINT "CitizenDeviceToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CitizenDeviceToken" ADD CONSTRAINT "CitizenDeviceToken_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "CitizenDeviceToken_tenantId_token_key" ON "CitizenDeviceToken"("tenantId", "token");
CREATE INDEX "CitizenDeviceToken_tenantId_citizenId_idx" ON "CitizenDeviceToken"("tenantId", "citizenId");
