-- Migration: add slaBreachedAt to Ticket and lastAttemptAt to OutboundDelivery
-- Generated: 2026-05-20

-- Add slaBreachedAt to Ticket model
-- Records the first timestamp when a ticket's resolutionDueAt was exceeded while in an actionable status.
ALTER TABLE "Ticket" ADD COLUMN "slaBreachedAt" TIMESTAMP(3);

-- Add lastAttemptAt to OutboundDelivery model
-- Records the timestamp of the most recent delivery attempt for observability and retry analysis.
ALTER TABLE "OutboundDelivery" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
