ALTER TABLE "Tenant" ADD COLUMN "widgetEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "widgetTitle" TEXT NOT NULL DEFAULT 'Belediye asistanı';
ALTER TABLE "Tenant" ADD COLUMN "widgetWelcome" TEXT NOT NULL DEFAULT 'Merhaba, belediyeye iletmek istediğiniz konuyu yazın.';
ALTER TABLE "Tenant" ADD COLUMN "widgetAllowedOrigins" JSONB;
