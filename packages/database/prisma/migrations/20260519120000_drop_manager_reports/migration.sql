-- Remove ManagerReport table. Admin reports are served via real-time /analytics/* endpoints;
-- the ManagerReport model was never written to (reports.processor was a stub) and had no API.
-- This is a safe drop: no application code reads from this table.
DROP TABLE IF EXISTS "ManagerReport";
