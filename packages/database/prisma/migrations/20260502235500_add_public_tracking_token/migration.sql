ALTER TABLE "Ticket"
ADD COLUMN "publicTrackingToken" TEXT;

CREATE UNIQUE INDEX "Ticket_tenantId_publicTrackingToken_key"
ON "Ticket"("tenantId", "publicTrackingToken");
