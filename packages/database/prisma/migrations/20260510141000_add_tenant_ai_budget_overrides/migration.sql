-- Per-tenant AI budget overrides (W4.3)
-- Forward-only. Tenants can override the global daily token / cost / per-request limits.
-- Null means: use the global env defaults from AI_DAILY_TOKEN_BUDGET / AI_DAILY_COST_BUDGET_MICROS / AI_PER_REQUEST_TOKEN_LIMIT.
ALTER TABLE "Tenant" ADD COLUMN "aiBudgetOverrides" JSONB;
