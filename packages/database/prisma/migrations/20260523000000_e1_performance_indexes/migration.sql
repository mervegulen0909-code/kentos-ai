-- E1: Performance indexes for CSAT lookups and SLA breach queries

-- Combined status + resolutionDueAt for SLA worker queries
-- (filters active tickets nearing/past deadline without full scan)
CREATE INDEX IF NOT EXISTS "Ticket_tenantId_status_resolutionDueAt_idx"
  ON "Ticket"("tenantId", "status", "resolutionDueAt");

-- Combined status + resolvedAt for CSAT response matching
-- (filters RESOLVED tickets within 48h window efficiently)
CREATE INDEX IF NOT EXISTS "Ticket_tenantId_status_resolvedAt_idx"
  ON "Ticket"("tenantId", "status", "resolvedAt");

-- slaBreachedAt for SLA breach analytics queries
CREATE INDEX IF NOT EXISTS "Ticket_tenantId_slaBreachedAt_idx"
  ON "Ticket"("tenantId", "slaBreachedAt");
