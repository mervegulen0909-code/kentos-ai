-- Add per-tenant retention override field to Tenant.
-- Tenants can store a JSON object of per-scope retention day overrides.
-- Null means: use the global default from the worker retention processor.
ALTER TABLE "Tenant" ADD COLUMN "retentionOverrides" JSONB;
