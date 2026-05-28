-- FAZ 1.9: Admin IP allowlist per tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ipAllowlist" JSONB;
