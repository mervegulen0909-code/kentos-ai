-- F4: GIS-based department routing
-- Add departmentId to Neighborhood for automatic routing

ALTER TABLE "Neighborhood" ADD COLUMN "departmentId" TEXT;

ALTER TABLE "Neighborhood" ADD CONSTRAINT "Neighborhood_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Neighborhood_tenantId_departmentId_idx" ON "Neighborhood"("tenantId", "departmentId");
