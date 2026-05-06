# Release Notes

## Next — Principal engineer audit hardening — 2026-05-06

### Summary

- Centralized deterministic public intake fallback classification into shared domain code consumed by both the API and AI runner.
- Fixed smoke verification drift around widget QA origins and aligned citizen dedup regression coverage with the current public intake reuse policy.
- Threaded safe admin mutation error messaging from [`ApiError.safeMessage`](apps/admin-web/lib/api.ts:19) through server-action redirects into admin notices.
- Closed the citizen identity audit with a schema-backed reconciliation ADR centered on identifier normalization, staged merge handling, and non-destructive rollout.
- Implemented the first schema-backed citizen identity slice with `CitizenIdentifier`, identifier-backed public intake resolution, conversation citizen linking, WhatsApp replay idempotency, and production fail-closed channel guards.

### Evidence snapshot

- Branch/sync: local working tree with intentional hardening diff in progress
- Static checks: `db:generate=passed`, `typecheck=passed`, `build=passed`
- Database migration: `20260506120000_citizen_identity_reconciliation=applied locally`
- API smoke: `passed` with citizen identifier backfill and WhatsApp internal ingest replay idempotency checks
- Browser/dev runtime: admin web recompiled cleanly on QA port `3111`; no new runtime error surfaced during the safe-message threading change
- Data-model decision: [`0002 — Citizen Identity and Reconciliation Strategy`](docs/decisions/0002-citizen-identity-reconciliation.md:1) added

### Principal-engineer risk register

- P1 closed: duplicated deterministic intake logic divergence risk, remediated by [`buildDeterministicIntakeClassification()`](packages/shared/src/intake-deterministic.ts:80)
- P1 closed: smoke false-negative risk from mismatched widget QA origins in [`scripts/smoke-api.mjs`](scripts/smoke-api.mjs:719)
- P1 closed: admin operators receiving generic mutation failures instead of safe actionable notices in [`runSettingsMutation()`](apps/admin-web/app/settings/actions.ts:26) and [`runTicketMutation()`](apps/admin-web/app/tickets/actions.ts:14)
- P1 closed: citizen identity uniqueness is now schema-backed through `CitizenIdentifier`, and public/conversation intake uses the shared reconciliation service.
- P1 closed: WhatsApp/internal replay risk is reduced by `ChannelEvent` idempotency on inbound `externalMessageId`.
- P2 open: historical citizen backfill/exception-report command is still needed before production rollout with existing tenant data.
- P2 open: external WhatsApp provider signature verification remains a production gate.
- P2 open: workspace-wide [`pnpm build`](package.json) can still be blocked on Windows when the active API dev process locks [`apps/api/dist`](apps/api/dist)

### Risk and rollback

- Risk level: `medium-low` because P1 correctness and UX gaps are closed, but historical citizen backfill and external provider signature verification still require follow-through.
- Rollback policy: revert the shared intake extraction, admin error threading, and smoke assertions as isolated patches if regressions surface; keep ADR documentation even if implementation timing changes.

## Next — PDF-style assistant product wave — 2026-05-05

### Summary

- Added embeddable citizen assistant foundations: `/widget.js`, `/widget/[tenantSlug]`, WEB_CHAT ticket creation, and admin self-serve widget install code.
- Added conversation-first intake endpoints with pre-ticket state in `Conversation.context` and deterministic follow-up/ticket creation handoff.
- Added channel-neutral intake envelopes and WhatsApp internal handoff with protected `/internal/channel-ingest` plus smoke coverage.
- Added `/analytics/channels` for channel-level ticket/conversation/message/automation summary.
- Hardened public citizen endpoints with widget origin allowlist and tenant/IP rate-limit controls.

### Evidence snapshot

- Branch/sync: local `master`, broad intentional working-tree diff in progress
- Static checks: `typecheck=passed`, `build=passed`
- API smoke: `passed` with WhatsApp internal ingest, analytics channel RBAC, blocked-origin, and allowed-origin public ticket coverage
- Browser smoke: `passed` via Playwright smoke on QA ports (`admin login`, `admin widget install`, `citizen report`, `citizen track`, `citizen widget preview`)
- Local API runtime: passed on port `3110` with `WIDGET_ORIGIN_ALLOWLIST` and `INTERNAL_API_KEY`

### New environment controls

- `WIDGET_ORIGIN_ALLOWLIST`: comma-separated allowed origins for public widget/ticket/conversation endpoints.
- `PUBLIC_RATE_LIMIT_MAX`: per tenant/IP public request limit.
- `PUBLIC_RATE_LIMIT_WINDOW_MS`: public rate-limit window size.
- `INTERNAL_API_KEY`: shared internal key for WhatsApp/channel ingest handoff.

### Risk and rollback

- Risk level: `low` after API smoke, static verification, and Playwright browser smoke passed for the new widget/admin-install flows.
- Rollback policy: disable `WIDGET_ORIGIN_ALLOWLIST` only for local debugging; for production rollback, remove the widget script from tenant websites and keep classic citizen report/track routes available.

## v0.1.0 — 2026-05-04

### Summary

- Stabilized release gating with CI workflow coverage for DB generate/migrate/seed, typecheck, build, and API smoke.
- Closed strict browser sign-off to `passed` with explicit citizen I/J/K evidence and Scenario L confirmation.
- Standardized release evidence language (`passed|partial|blocked|not_run`), owner/SLA tracking, and run-log snapshot format.

### Evidence snapshot

- Branch/sync: `master`, `origin/master...master = 0 0`
- Static checks: `db:generate=passed`, `typecheck=passed`, `build=passed`
- API smoke: `passed`
- Browser smoke: `passed`
- CI status: latest run success (`CI / verify`)

### Known platform constraint

- Branch protection API enforcement is blocked by repository plan/public constraints (`403`).
- Technical fallback is now tightened to CODEOWNERS review expectations plus PR evidence that explicitly records the required CI jobs (`verify`, `ui-e2e`) until native GitHub branch protection can be enabled.

### Risk and rollback

- Risk level: `low`
- Rollback policy: if strict browser Scenario L evidence is missing in a future cycle, revert browser status to `partial` and hold merge decision.

### Release reference

- Release commit: `19c6cc5`
- Tag: `v0.1.0`
