# 0002 — Citizen Identity and Reconciliation Strategy

## Status

Proposed

## Context

[`Citizen`](packages/database/prisma/schema.prisma:214) is currently a thin tenant-scoped contact record with optional [`phone`](packages/database/prisma/schema.prisma:218) and [`email`](packages/database/prisma/schema.prisma:219), plus non-unique indexes only. The current public intake matching logic in [`resolveCitizen()`](apps/api/src/modules/public/public-ticket.service.ts:46) reuses the oldest citizen row that matches either phone or email and backfills missing fields.

This is a good P0/P1 safety baseline because it prevents obvious duplicate creation during public ticket intake, but it leaves three structural risks open:

First, the schema does not guarantee uniqueness for normalized citizen identifiers within a tenant. Two records can still exist for the same phone or email, and the application layer then resolves this ambiguity by first-created order.

Second, identity is stored directly on the [`Citizen`](packages/database/prisma/schema.prisma:214) row rather than as a first-class set of verifiable identifiers. That makes cross-channel reconciliation brittle for flows such as [`Conversation`](packages/database/prisma/schema.prisma:322), public web tickets, and future WhatsApp normalization.

Third, there is no explicit merge or supersession model. If duplicates already exist, introducing hard unique constraints directly on [`Citizen.phone`](packages/database/prisma/schema.prisma:218) or [`Citizen.email`](packages/database/prisma/schema.prisma:219) would be migration-risky and could break seeded or live tenant data.

## Decision

Introduce a schema-backed citizen identity layer and migrate reconciliation in phases.

The target design keeps [`Citizen`](packages/database/prisma/schema.prisma:214) as the canonical person/contact aggregate for tenant-facing operations, while moving unique matching responsibility into a new child table, tentatively named `CitizenIdentifier`.

Recommended shape:

- `Citizen` remains the canonical entity referenced by [`Ticket.citizenId`](packages/database/prisma/schema.prisma:237) and [`Conversation.citizenId`](packages/database/prisma/schema.prisma:325).
- Add `CitizenIdentifier` with fields:
  - `id`
  - `tenantId`
  - `citizenId`
  - `kind` with values such as `PHONE` and `EMAIL`
  - `normalizedValue`
  - `isPrimary`
  - `isVerified`
  - `source` such as `PUBLIC_WEB`, `WEB_CHAT`, `WHATSAPP`, `STAFF`, `IMPORT`, `MERGE`
  - `createdAt`
  - `updatedAt`
- Add a tenant-scoped uniqueness constraint on [`CitizenIdentifier.kind`](docs/decisions/0002-citizen-identity-reconciliation.md) + `normalizedValue`, not on raw citizen columns.
- Keep [`Citizen.phone`](packages/database/prisma/schema.prisma:218) and [`Citizen.email`](packages/database/prisma/schema.prisma:219) temporarily as denormalized convenience fields during transition, populated from the primary identifier set.
- Add nullable merge metadata on `Citizen`, preferably `mergedIntoCitizenId` and `mergedAt`, so historical foreign keys remain valid during staged cleanup and audit review.

## Why this design

This design separates three concerns that are currently collapsed into one row.

A canonical citizen record answers “which person/contact aggregate owns tickets and conversations.”

An identifier record answers “which normalized phone/email values are allowed to resolve to that citizen, and are they unique inside the tenant.”

A merge marker answers “what happened when duplicate rows already existed.”

That gives us deterministic identity without requiring a risky big-bang rewrite of all existing relations.

## Normalization rules

Normalization must be centralized before persistence and lookup.

For phone numbers, use a single municipal-safe canonical format such as E.164-like Turkish normalization, for example converting local mobile input variants to a single `905xxxxxxxxx` representation. The existing contact handling in [`normalizeContact()`](apps/api/src/modules/public/public-conversation.service.ts:183) and public intake matching in [`resolveCitizen()`](apps/api/src/modules/public/public-ticket.service.ts:46) should stop making independent assumptions and instead call one shared normalizer.

For email addresses, lowercase with locale-safe rules and trim whitespace before persistence.

Raw user-entered values may still be preserved in audit context if needed, but matching and uniqueness must use normalized values only.

## Migration strategy

Phase 1 is additive and safe.

Add the new `CitizenIdentifier` table and merge metadata columns on `Citizen`. Do not add destructive constraints to existing [`Citizen`](packages/database/prisma/schema.prisma:214) fields yet. Update write paths so new citizen creation and reconciliation populate both the citizen row and identifier rows.

Phase 2 is reconciliation.

Run a data migration that groups citizens by tenant and normalized identifier, chooses a canonical survivor, re-points dependent rows such as [`Ticket.citizenId`](packages/database/prisma/schema.prisma:237) and [`Conversation.citizenId`](packages/database/prisma/schema.prisma:325), marks duplicates as merged, and records identifier ownership on the survivor.

Canonical selection should be deterministic and conservative. Prefer the row with the greatest relationship weight, then earliest creation time as tie-breaker. Relationship weight should prioritize rows already linked from tickets and conversations, because they carry operational history.

Phase 3 is enforcement.

After reconciliation is clean, add the unique tenant constraint on `CitizenIdentifier`. At this stage, application matching should query identifiers first and resolve to the owning citizen, rather than scanning citizens by OR conditions.

Phase 4 is optional cleanup.

Once all reads are identifier-backed and the backfill has proven stable, decide whether [`Citizen.phone`](packages/database/prisma/schema.prisma:218) and [`Citizen.email`](packages/database/prisma/schema.prisma:219) remain as cache columns or are retired from matching logic entirely.

## Required application changes

[`resolveCitizen()`](apps/api/src/modules/public/public-ticket.service.ts:46) should be refactored to:

1. normalize incoming phone/email once,
2. look up existing `CitizenIdentifier` rows inside the tenant,
3. resolve conflicts deterministically,
4. create a new citizen only when no identifier exists,
5. attach newly discovered secondary identifiers to the existing citizen where safe,
6. never overwrite an existing stronger identity with weaker channel input.

[`PublicConversationService.start()`](apps/api/src/modules/public/public-conversation.service.ts:36) currently creates conversations without linking a citizen even when contact exists. After Phase 1, conversation start and message ingestion should opportunistically resolve a citizen and persist [`Conversation.citizenId`](packages/database/prisma/schema.prisma:325) early, so later ticket creation and operator handoff inherit the same identity anchor.

Any future WhatsApp or operator import path must use the same identifier service rather than writing raw citizen rows directly.

## Non-goals

This decision does not attempt household modeling, legal identity verification, or cross-tenant citizen federation. Identity remains tenant-scoped by design, consistent with the multi-tenant boundary in [`0001 — MVP Stack Decision`](docs/decisions/0001-mvp-stack.md:1).

## Consequences

Benefits include deterministic tenant-scoped citizen matching, safer future channel expansion, and a migration path that does not require immediate destructive deduplication.

Costs include one extra relational hop for writes and some reads, a reconciliation migration, and the need for a shared normalization utility.

## Implementation order

1. Add schema objects and non-destructive migration.
2. Introduce shared contact normalization utilities.
3. Refactor public ticket and conversation flows to use identifier-backed resolution.
4. Run reconciliation/backfill and produce an exception report for ambiguous merges.
5. Add unique enforcement on identifiers.
6. Close the audit item only after rerunning [`pnpm db:generate`](package.json), [`pnpm typecheck`](package.json), and relevant smoke coverage.
