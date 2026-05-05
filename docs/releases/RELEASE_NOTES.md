# Release Notes

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
