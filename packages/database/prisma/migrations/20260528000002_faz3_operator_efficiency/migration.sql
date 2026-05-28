-- FAZ 3.1: Canned reply templates
CREATE TABLE IF NOT EXISTS "CannedReply" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "ownerId"   TEXT,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "shortCode" TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CannedReply_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CannedReply"
  ADD CONSTRAINT "CannedReply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CannedReply_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CannedReply_tenantId_ownerId_isActive_idx" ON "CannedReply"("tenantId", "ownerId", "isActive");

-- FAZ 3.2: Ticket tags / labels
CREATE TABLE IF NOT EXISTS "TicketTag" (
  "id"       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "name"     TEXT NOT NULL,
  "color"    TEXT NOT NULL DEFAULT '#6366f1',
  CONSTRAINT "TicketTag_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TicketTag"
  ADD CONSTRAINT "TicketTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "TicketTag_tenantId_name_key" ON "TicketTag"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "TicketTag_tenantId_idx" ON "TicketTag"("tenantId");

-- Many-to-many: Ticket <-> TicketTag
CREATE TABLE IF NOT EXISTS "_TicketTags" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_TicketTags_pkey" PRIMARY KEY ("A", "B")
);
ALTER TABLE "_TicketTags"
  ADD CONSTRAINT "_TicketTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Ticket"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "_TicketTags_B_fkey" FOREIGN KEY ("B") REFERENCES "TicketTag"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "_TicketTags_B_index" ON "_TicketTags"("B");

-- FAZ 3.4: Ticket watchers / followers
CREATE TABLE IF NOT EXISTS "TicketWatcher" (
  "tenantId"  TEXT NOT NULL,
  "ticketId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("ticketId", "userId")
);
ALTER TABLE "TicketWatcher"
  ADD CONSTRAINT "TicketWatcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "TicketWatcher_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "User"("id")   ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "TicketWatcher_tenantId_userId_idx" ON "TicketWatcher"("tenantId", "userId");

-- FAZ 3.5: Ticket sub-tasks / checklist
CREATE TABLE IF NOT EXISTS "TicketChecklistItem" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "ticketId"  TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "done"      BOOLEAN NOT NULL DEFAULT false,
  "position"  INT NOT NULL DEFAULT 0,
  "doneAt"    TIMESTAMP(3),
  "doneById"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketChecklistItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TicketChecklistItem"
  ADD CONSTRAINT "TicketChecklistItem_ticketId_fkey"  FOREIGN KEY ("ticketId")  REFERENCES "Ticket"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "TicketChecklistItem_doneById_fkey"  FOREIGN KEY ("doneById")  REFERENCES "User"("id")   ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "TicketChecklistItem_tenantId_ticketId_idx" ON "TicketChecklistItem"("tenantId", "ticketId");
