DROP INDEX IF EXISTS "MessageTemplate_tenantId_key_locale_key";

DELETE FROM "MessageTemplate" duplicate
USING "MessageTemplate" keep
WHERE keep."tenantId" = duplicate."tenantId"
  AND keep."key" = duplicate."key"
  AND keep."locale" = duplicate."locale"
  AND keep."channel" IS NULL
  AND duplicate."channel" IS NULL
  AND (
    keep."createdAt" < duplicate."createdAt"
    OR (keep."createdAt" = duplicate."createdAt" AND keep."id" < duplicate."id")
  );

DELETE FROM "MessageTemplate" duplicate
USING "MessageTemplate" keep
WHERE keep."tenantId" = duplicate."tenantId"
  AND keep."key" = duplicate."key"
  AND keep."locale" = duplicate."locale"
  AND keep."channel" = duplicate."channel"
  AND keep."channel" IS NOT NULL
  AND (
    keep."createdAt" < duplicate."createdAt"
    OR (keep."createdAt" = duplicate."createdAt" AND keep."id" < duplicate."id")
  );

CREATE UNIQUE INDEX "MessageTemplate_tenantId_key_locale_generic_key"
ON "MessageTemplate"("tenantId", "key", "locale")
WHERE "channel" IS NULL;

CREATE UNIQUE INDEX "MessageTemplate_tenantId_key_locale_channel_key"
ON "MessageTemplate"("tenantId", "key", "locale", "channel")
WHERE "channel" IS NOT NULL;
