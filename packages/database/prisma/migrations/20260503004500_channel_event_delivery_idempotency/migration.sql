CREATE UNIQUE INDEX "ChannelEvent_delivery_event_idempotency_key"
ON "ChannelEvent"("tenantId", "channel", "provider", "externalEventId")
WHERE "externalEventId" IS NOT NULL;
