# Release Notes

## Next - Production VPS deploy closure - 2026-05-12

### Summary

- 2026-05-16 implementation checkpoint: repo hygiene now ignores local Codex/Playwright browser artifacts and provider screenshots, outbound worker retry bookkeeping is regression-tested, admin reports expose outbound delivery health, and widget/browser smoke coverage now includes same-conversation follow-up plus automated 390px mobile checks.
- Re-verified production external systems on 2026-05-13: external preflight is fully green, production widget diagnostics allow the real municipality origin, and local gateway smoke now handles Meta's plain-text webhook challenge response.
- Deployed the self-hosted KentOS stack to the Hetzner VPS at `46.224.217.16` with DNS served through the Natro-managed domains.
- Fixed production runtime packaging issues found during the first deploy: API and worker start paths now point at their built package entrypoints, workspace package `main` fields point at built outputs, and Prisma Client is generated with the normal query engine instead of no-engine/Data Proxy mode.
- Installed OpenSSL in the production Node image so Prisma can detect the runtime SSL library reliably.
- Enabled production attachment scanning by switching `ATTACHMENT_SCAN_PROVIDER=clamav` after the in-stack ClamAV daemon was healthy, then recreated the worker with `CLAMAV_HOST=clamav` and `CLAMAV_PORT=3310`.
- Seeded the production demo tenant (`demo-belediye`) for approved smoke testing, configured Postmark inbound Basic Auth values, mapped inbound EMAIL messages to the demo tenant, and recreated the gateway with the new env.
- Created a repo-local in-app-browser smoke path for production read-only checks; the separate Chrome profile remains ignored and is not required for current verification.

### Production evidence snapshot

- DNS records for `xn--izmirusul-y9a.com`, `api.xn--izmirusul-y9a.com`, `admin.xn--izmirusul-y9a.com`, `vatandas.xn--izmirusul-y9a.com`, and `gateway.xn--izmirusul-y9a.com` resolve to `46.224.217.16`.
- `docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml ps` on the VPS shows API, Caddy, Postgres, Redis, MinIO, ClamAV, worker, admin-web, citizen-web, and whatsapp-gateway running; API and ClamAV are healthy.
- `pnpm ops:external -- --env-file .env.production.local --expected-server-ip 46.224.217.16 --compose --json` reports `passed=23`, `warning=1`, `blocked=0`, `failed=0`. The remaining warning is local Docker Desktop being unavailable for local compose ps; VPS compose state was verified over SSH.
- HTTPS probes pass: API health/ready, gateway health, admin web, citizen web, and municipality web all return expected 200 responses.
- In-app browser read-only smoke opened the municipality homepage, citizen widget preview, and admin login page on production domains without raw errors.
- Approved production write-path smoke passed: public attachment presign/upload/confirm, public ticket create/track, public-safe attachment metadata check, admin login/list/detail, internal note, status transition, audit-log read, and invalid-token public 404.
- Worker media evidence passed: the smoke attachment was processed by `kentos.media` and recorded `scanStatus=CLEAN`, `scanProvider=clamav`.
- EMAIL inbound smoke passed: missing Basic Auth returns `401`, valid Basic Auth accepts a Postmark-style payload and produces an EMAIL envelope for the demo tenant. No live outbound send was made.
- 2026-05-13 closure evidence: `pnpm ops:external -- --env-file .env.production.local --expected-server-ip 46.224.217.16 --compose --json` reports `passed=23`, `warning=1`, `blocked=0`, `failed=0`; the only warning is local Docker Desktop `compose ps` being unavailable. Playwright CLI verified the production municipality homepage, embedded widget iframe, admin login, reports, and settings widget install/probe surfaces.
- Gateway smoke evidence: local dry-run gateway with dummy signature secrets passes `pnpm smoke:gateway`; the smoke script now parses JSON only when the response is actually JSON, preserving Meta's required plain-text challenge behavior.
- Local implementation evidence: `pnpm --filter @kentos/worker test`, `pnpm --filter @kentos/api typecheck`, `pnpm --filter @kentos/admin-web typecheck`, and `pnpm --filter @kentos/citizen-web typecheck` passed after the 2026-05-16 implementation slice.
- Final local gate evidence: `pnpm ops:preflight -- --with-verification --json` completed with all verification commands passed (`db:generate`, `api-test`, `worker-test`, `shared-test`, `typecheck`, `build`, `diff-check`); status remains `blocked` only because the implementation worktree is intentionally dirty. `pnpm ops:external -- --env-file .env.production.local --expected-server-ip 46.224.217.16 --compose --json` returned `passed=23`, `warning=1`, `blocked=0`, `failed=0`; the warning is local Docker Desktop `compose ps` unavailable.

### Safety posture

- No live outbound flags are enabled.
- Retention remains in dry-run/safe mode.
- AI provider is configured through the guarded provider path; live calls remain budget-gated and no new paid call was made during the 2026-05-13 closure pass.
- Production data mutation smoke was run only after explicit operator approval and used demo tenant data.
- Email inbound is configured for the demo tenant; live email outbound remains disabled.

### Risk and rollback

- Risk level: `low` for current live state: core services are healthy, HTTPS is serving, migrations are applied, and write-heavy/live external paths remain gated.
- Rollback policy: revert the production runtime commits and redeploy the previous archive if runtime packaging regresses; to stop attachment scanning without code rollback, set `ATTACHMENT_SCAN_PROVIDER=placeholder` and recreate the worker.

## Next - External systems preflight + municipality widget domain - 2026-05-11

### Summary

- Added `pnpm ops:external`, a production external-system preflight helper that loads `.env.production.local`, checks required production env, provider readiness, safety gates, DNS/HTTPS probes, and optional Docker Compose state. Default mode is read-only and writes Markdown reports under `output/ops-external-systems/`.
- Added explicit deployment flags to the helper: `--apply-deploy --i-accept-production-deploy` are required before it runs the documented production compose build/up/migrate sequence. Live outbound and retention delete modes remain blocked unless their own approval flags are supplied.
- Extended production bootstrap/env docs with `MUNICIPALITY_DOMAIN`, `DEFAULT_TENANT_SLUG`, `PUBLIC_CITIZEN_BASE_URL`, and `PUBLIC_GATEWAY_BASE_URL`.
- Added a simple Caddy-served demo municipality homepage on `MUNICIPALITY_DOMAIN` with the KentOS widget script embedded from the citizen domain.
- Admin Settings widget install code now emits an absolute citizen-web script URL when `NEXT_PUBLIC_CITIZEN_WEB_BASE_URL` / `PUBLIC_CITIZEN_BASE_URL` is configured, so copy-pasted install snippets work on external municipality sites.

### Safety posture

- No production deploy is performed automatically. The new deploy path fails closed on existing blocked checks and requires the explicit production acceptance flag.
- The external preflight never prints secret values; env checks are presence-only.
- Live channel sends, paid AI, retention delete, and provider setup remain separate operator-gated actions.

### Evidence snapshot

- `node --check scripts/ops-external-systems.mjs=passed`.
- `node --check scripts/bootstrap-prod-env.mjs=passed`.
- `pnpm ops:external -- --env-file .env.production.local --skip-network --json=passed` with only expected warnings for skipped network probes, placeholder attachment scanning, and incomplete optional email inbound values.
- `pnpm ops:external -- --env-file .env.production.local --compose --skip-network --json=passed` with elevated local permission: compose config passed; `compose ps` warned because Docker Desktop daemon is not running.
- `docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml config --quiet=passed`.
- `pnpm typecheck=passed`.
- `pnpm build=passed`.
- `git diff --check=passed`.

### Risk and rollback

- Risk level: `low`. The change is additive tooling/docs plus a Caddy demo site and admin snippet URL correction. It does not touch local dev runtime paths or perform external side effects.
- Rollback policy: revert this slice; the existing production scaffold remains usable without the extra external preflight helper or municipality demo domain.

## Next — AI provider live wiring + cost cap + telemetry (W3.4) — 2026-05-10

### Summary

- New Anthropic intake provider in `PublicTicketAiService`. When `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` is set, the service POSTs to `https://api.anthropic.com/v1/messages` with `x-api-key` and `anthropic-version` headers, captures `usage.input_tokens` / `usage.output_tokens`, and persists those into the `AiRun` row. No SDK dependency — direct `fetch` keeps `apps/api` package.json untouched.
- Provider preference order: `anthropic` (preferred) → `netiva` → `stub` (deterministic). Each layer falls back to the next on error or when its credentials are unset; stub fallbacks record an `errorReason` like `anthropic:request failed with 429`.
- Budget guard: `AI_DAILY_TOKEN_BUDGET` and `AI_DAILY_COST_BUDGET_MICROS` enforce a per-tenant 24h cap. Before each live call, `AiRun` aggregates over the last 24h for the tenant are summed; if either cap is reached the call is short-circuited to the deterministic stub with `errorReason='budget:token-budget-exceeded'` (or cost-budget). Calls inside the budget run normally and contribute to the next aggregate.
- Token cost is computed per-request via `AI_COST_INPUT_MICROS_PER_TOKEN` (default 3) and `AI_COST_OUTPUT_MICROS_PER_TOKEN` (default 15) — the published claude-sonnet-4-6 list price of $3/$15 per million tokens.
- Telemetry: every classify call writes an `AiRun` row with provider, model, promptVersion, latencyMs, token counts, costMicros, success, errorReason. Failures during telemetry persistence are swallowed so the citizen-facing ticket flow never breaks because of a logging issue.

### Schema (forward-only)

Migration `20260510140000_add_ai_run_telemetry` extends `AiRun` with `tokensInput`, `tokensOutput`, `tokensTotal`, `costMicros` (all nullable INT), `success` (NOT NULL DEFAULT true), `errorReason` (TEXT), and a new index on `(tenantId, createdAt)` for the daily aggregate query path.

### Configuration

```
AI_PROVIDER=stub | netiva | anthropic
AI_DAILY_TOKEN_BUDGET=        # leave empty for unlimited
AI_DAILY_COST_BUDGET_MICROS=  # leave empty for unlimited
AI_PER_REQUEST_TOKEN_LIMIT=
AI_DAILY_BUDGET_BLOCK_MODE=fallback   # fallback (default) | error
AI_COST_INPUT_MICROS_PER_TOKEN=3
AI_COST_OUTPUT_MICROS_PER_TOKEN=15
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_TIMEOUT_MS=15000
ANTHROPIC_MAX_TOKENS=1200
ANTHROPIC_API_VERSION=2023-06-01
```

### Safety / KVKK posture

- `AI_PROVIDER=stub` remains the default; no live model call happens until the operator flips it and provides a key.
- Budget caps default to "unlimited" only because operators may want to set them per environment. The runbook now lists daily budget configuration as a pre-go-live step. Without a budget set the audit trail still records every run's token count and cost.
- Telemetry payload (`input` and `output` JSON columns) intentionally records only `tenantSlug`, channel, intent, requestType, and confidence — no citizen contact, no AI prompt, no model-internal reasoning.

### Evidence snapshot

- `PRISMA_GENERATE_NO_ENGINE=true pnpm db:generate=passed`.
- `pnpm typecheck=passed` for all 8 workspace projects.
- `pnpm --filter @kentos/api test=passed` 11 new ai-cost-guard tests covering env config parsing, budget decision logic for token and cost caps, cost estimation with input/output rates, anthropic and OpenAI usage extractors, and missing-usage handling. Existing citizen identity reconciliation and attachment service tests still pass.
- `pnpm build=passed`.

### Risk and rollback

- Risk level: `medium`. Schema change is additive and forward-only; the AiRun model is now actively written. Provider switch defaults to stub when keys are unset, so the change is safe to deploy without immediately enabling live calls.
- Rollback policy: revert the W3.4 commit; the new `AiRun` columns and index remain (forward-only) but unused. To stop live calls without reverting, set `AI_PROVIDER=stub` and restart the api.

## Next — ClamAV virus scanning (W3.3) — 2026-05-10

### Summary

- Real attachment virus scanning is now wired into the worker `kentos.media` queue. Replaces the previous `placeholder` no-op.
- New `Attachment.scanStatus` (`PENDING | CLEAN | INFECTED | ERROR | SKIPPED`), `scanProvider`, `scanThreat`, `scanResult`, `scannedAt` columns via forward-only migration `20260510134500_add_attachment_scan_status`. Existing rows default to `PENDING`.
- Dependency-free ClamAV INSTREAM client (`apps/worker/src/scan/clamav-client.ts`) — opens a TCP socket, sends `zINSTREAM`, streams 4-byte length-prefixed chunks, parses OK/FOUND/ERROR, supports a configurable timeout.
- `media.processor` refactored to `runMediaJob({ scan, updateAttachment })` for dependency-injection-friendly testing. Production wiring streams the S3 object via `GetObjectCommand` straight to ClamAV without buffering the full file. Skips with status `SKIPPED` when `ATTACHMENT_SCAN_PROVIDER=placeholder`, missing, or unknown.
- Infected attachments are blocked at download: both admin (`createAdminDownload`) and public (`createPublicDownload`) signed-URL paths return `403 Forbidden` when `scanStatus='INFECTED'`. Citizen path inherits the same guard via the shared service method.
- `infra/docker-compose.prod.yml` adds a `clamav/clamav:1.4` service with a `clamav-prod-data` volume and a `nc`-based PING healthcheck. Worker depends on `clamav: service_healthy` and receives `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310`.

### Configuration

- `ATTACHMENT_SCAN_PROVIDER` — set to `clamav` to enable real scanning. Any other value (including the default `placeholder`) results in `SKIPPED` with a clear reason.
- `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`, `CLAMAV_CHUNK_SIZE` — ClamAV connection parameters.

### Safety / KVKK posture

- Scanning is opt-in. Until the operator switches `ATTACHMENT_SCAN_PROVIDER` from `placeholder` to `clamav` and the daemon is reachable, attachments stay `PENDING` and downloads work normally.
- Infected attachments are never deleted automatically. They are left in S3 with `scanStatus='INFECTED'` and the download path is blocked. Retention can clear them later through the existing dry-run/live-delete worker flags.
- Scan failures (`ERROR`) do not block downloads to avoid breaking citizen support during transient daemon outages; operator-visible status is recorded for follow-up.

### Evidence snapshot

- `PRISMA_GENERATE_NO_ENGINE=true pnpm db:generate=passed`.
- `pnpm typecheck=passed` for all 8 workspace projects.
- `pnpm --filter @kentos/worker test=passed` 26/26, including 10 new ClamAV client tests against an in-process stub TCP server (clean OK, infected FOUND with threat name, ERROR response, silent timeout) and 5 new media processor tests with injected scanner/updater (CLEAN persistence, INFECTED with threat, scanner not called on validation failure, ERROR persistence, DB persistence failure does not fail the job).
- `pnpm --filter @kentos/api test=passed`.
- `pnpm build=passed` for api/admin-web/citizen-web/whatsapp-gateway/worker.

### Risk and rollback

- Risk level: `low` to `medium`. Schema change is additive (new columns + new enum, default `PENDING`). Existing media flow continues without scanning until `ATTACHMENT_SCAN_PROVIDER=clamav` is set, so the change is safe to deploy without the daemon up. The download guard only activates on `INFECTED` rows, which can only be created once scanning is live.
- Rollback policy: revert the W3.3 commit; the schema columns and `AttachmentScanStatus` enum remain in the DB (forward-only) but are unused. To stop scanning without reverting code, set `ATTACHMENT_SCAN_PROVIDER=placeholder` and restart the worker.

## Next — EMAIL outbound provider scaffold (W3.2) — 2026-05-10

### Summary

- Added an EMAIL outbound provider to the channel gateway following the existing SMS provider pattern. Dry-run is the default and is exercised whenever `EMAIL_OUTBOUND_LIVE !== 'true'`.
- Two transports supported behind one `EMAIL_PROVIDER` switch:
  - `smtp` (default): lazy-imported `nodemailer` runtime dependency. The gateway's `package.json` does **not** add `nodemailer` so the dry-run path stays dependency-free; live SMTP send requires the operator to install `nodemailer` separately. Errors are surfaced clearly.
  - `postmark`: pure `fetch` POST to `https://api.postmarkapp.com/email` with `X-Postmark-Server-Token` auth.
- Registered EMAIL alongside INSTAGRAM/FACEBOOK/SMS in `getGenericProvider`. Extended `GenericChannelKind` and `GenericChannelKey` shared/gateway types to include EMAIL.
- Added `POST /internal/email/outbound` route that mirrors the existing internal-key-protected outbound endpoints. Recipient extraction prefers `recipient.email` when the channel is EMAIL.
- Smoke (`pnpm smoke:gateway`) and unit tests both assert that missing/wrong internal key is rejected with `invalid-internal-key`, channel mismatch is rejected, and missing recipient is rejected.

### Configuration

New env vars (all default to safe/empty):

- `EMAIL_OUTBOUND_LIVE=false` — must be set to `true` before any real send is attempted.
- `EMAIL_PROVIDER=smtp` — `smtp` or `postmark`.
- `EMAIL_FROM_ADDRESS` — required for live send.
- `EMAIL_DEFAULT_SUBJECT` — defaults to `Belediye Bilgilendirmesi`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` — SMTP transport config.
- `POSTMARK_SERVER_TOKEN`, `POSTMARK_MESSAGE_STREAM` — Postmark transport config.

### Safety / KVKK posture

- Live send is opt-in; the dry-run code path has no network side effect and writes a single console line.
- The gateway never logs message bodies beyond a 60-char preview in dry-run.
- The internal API key check is identical to the existing channel routes; smoke tests assert both missing and wrong key cases.
- No new outbound credentials are committed; `.env.example` and `scripts/bootstrap-prod-env.mjs` ship blank values that fail closed at runtime.

### Evidence snapshot

- `pnpm typecheck=passed` for all 8 workspace projects.
- `pnpm --filter @kentos/whatsapp-gateway test=passed` 14/14, including 8 new EMAIL tests covering dry-run envelope, missing config rejection, postmark/SMTP error paths, recipient preference, channel mismatch, and internal-key rejection.
- `node --check scripts/smoke-gateway.mjs=passed` and `node --check scripts/bootstrap-prod-env.mjs=passed`.
- `pnpm build=passed` for api/admin-web/citizen-web/whatsapp-gateway/worker.

### Risk and rollback

- Risk level: `low` — additive provider, additive route, additive types union value. Existing channel flows (WhatsApp/Instagram/Facebook/SMS) are untouched. No real outbound send occurs unless the operator explicitly flips the live flag and provides credentials.
- Rollback policy: revert the W3.2 commit; the EMAIL channel value remains in the schema-side `ChannelType` enum (committed earlier in the W2 EMAIL drift closure) but the gateway no longer attempts to deliver.

## Next — Per-tenant retention overrides (W3.1) — 2026-05-10

### Summary

- Added a `Tenant.retentionOverrides Json?` column with a forward-only migration so each tenant can store per-scope retention day overrides without re-deploying or restarting the worker.
- Centralized retention vocabulary in `@kentos/shared`: `RETENTION_SCOPES`, `RetentionScope`, `TenantRetentionOverrides`, `TenantRetentionSettings`, `DEFAULT_RETENTION_DAYS`, and `MIN/MAX_RETENTION_DAYS` (1-3650 days). Both API and worker import the same source of truth.
- Worker `retention.processor` now resolves effective retention days per scope as: explicit job `retentionDays` → tenant override → shared default. The `all` scope expands into per-scope passes so each scope uses its own cutoff. Result envelope now exposes `effectiveRetentionDays` and `appliedOverrides` for evidence/log review.
- New API endpoints: `GET /retention-settings` (any authenticated tenant member) and `PATCH /retention-settings` (SUPER_ADMIN/TENANT_ADMIN). DTO uses class-validator with `Min(1) Max(3650)` per scope and writes a `tenant.retention_settings_updated` audit log.
- Admin settings panel exposes per-scope number inputs; blank fields revert to defaults. Inline notice text explains that tenant overrides only set the *window*; live DB deletion still depends on `RETENTION_DRY_RUN=false` and `RETENTION_DELETE_ATTACHMENT_OBJECTS=true` worker flags.

### Safety / KVKK posture

- Tenant-level overrides can shorten retention (stricter KVKK posture), not bypass dry-run safety. Live deletion still requires the explicit worker flags.
- Out-of-range or non-integer override values are silently ignored both in the API DTO (rejects with 400) and in the worker `normalizeOverrides()` defense layer (falls back to default).
- A new audit log entry is written on every retention override change with before/after diffs.

### Evidence snapshot

- `PRISMA_GENERATE_NO_ENGINE=true pnpm db:generate=passed` (Windows DLL workaround).
- `pnpm typecheck=passed` for all 8 workspace projects.
- `pnpm --filter @kentos/worker test=passed` 11/11, including 6 new tests covering tenant override precedence, explicit-arg override of tenant override, out-of-range fallback, and defensive `normalizeOverrides` parsing.
- `pnpm --filter @kentos/api test=passed` (citizen identity reconciliation + attachments suites).
- `pnpm build=passed` for api/admin-web/citizen-web/whatsapp-gateway/worker.

### Risk and rollback

- Risk level: `low` — additive schema change (nullable JSON column), additive endpoints, additive UI panel. Existing retention flows continue to work with `tenantId` unset (no override fetch, defaults apply).
- Rollback policy: revert the W3.1 commit; the `retentionOverrides` column remains in the DB schema (forward-only migration) but is unused. No data loss because no values are read until the worker is updated again.

## Next — Self-hosted production infra scaffold — 2026-05-10

### Summary

- Added a self-hosted single-VPS production scaffold: `infra/Dockerfile.prod`, `infra/docker-compose.prod.yml`, `infra/Caddyfile.prod`, `.dockerignore`.
- Added the env generator `scripts/bootstrap-prod-env.mjs` exposed as `pnpm infra:prod:bootstrap`. Secrets are produced with `crypto.randomBytes` and written only to `.env.production.local`, which is git-ignored; values are never echoed to stdout.
- Added the operator runbook `docs/workflows/production-infra-runbook.md` covering env generation, server bootstrap, first deploy, verification, safety rules, and backups.
- Added `start` scripts for admin-web, citizen-web, and worker; added `prisma:deploy` and root `db:deploy` and `infra:prod:bootstrap` scripts.

### Services in the scaffold

- PostgreSQL 16, Redis 7 (append-only with password auth), MinIO + bucket bootstrap (`minio-init`), KentOS API, KentOS worker, admin web, citizen web, WhatsApp/channel gateway, Caddy reverse proxy with automatic TLS.
- Compose uses healthchecks and `condition: service_healthy` waits to gate API on Postgres/Redis/MinIO and gate worker/web/gateway on the API.

### Safety posture (kept off by default)

- `*_OUTBOUND_LIVE=false` for WhatsApp, Instagram, Facebook, SMS, EMAIL.
- `RETENTION_DRY_RUN=true` and `RETENTION_DELETE_ATTACHMENT_OBJECTS=false`.
- `ATTACHMENT_SCAN_PROVIDER=placeholder` until a real provider is approved.
- No deploy is performed automatically. No image was built or pushed in this slice. DNS, ACME issuance, and any actual server provisioning remain manual operator actions.

### Evidence snapshot

- `node --check scripts/bootstrap-prod-env.mjs=passed`.
- `git diff --check=passed` (CRLF normalization warnings only).
- `PRISMA_GENERATE_NO_ENGINE=true pnpm db:generate=passed` (Windows DLL workaround documented in prior checkpoints).
- `pnpm typecheck=passed` across all 8 workspace projects.
- `pnpm build=passed` across all workspace projects.
- `pnpm ops:preflight` returned `blocked` only on `git-clean` while the in-flight slice was uncommitted, plus expected `prod-env-present` and `attachment-scan-provider` warnings. No new failures introduced by this slice.

### Risk and rollback

- Risk level: `low` — change is additive (new infra files, new docs, additive `start`/`deploy` scripts) and contains no runtime code paths reachable in local dev. No production target was touched.
- Rollback policy: revert the production-infra commit; admin/citizen/api/worker dev and existing local Docker compose are unaffected because `infra/docker-compose.yml` and existing `dev` scripts were not modified.

## Next — W2.0-W2.5 attachment milestone — 2026-05-10

### Summary

- Stabilized the W2.0-W2.5 local milestone across admin/citizen UI refresh, handoff workflow, root health ergonomics, and attachment storage.
- Added S3-compatible presigned attachment upload endpoints for admin and public channels.
- Added checksum confirmation, attachment audit coverage, and `kentos.media` queue payload handoff with a worker placeholder.
- Added attachment env controls for S3 region/path style, presign TTL, MIME allowlist, and max upload size.
- Productized attachment binding with `attachmentIds` on admin/public ticket and message create paths, including tenant/actor/confirmed-checksum checks.
- Added signed download endpoints for staff and public tracking-code access; public responses expose safe metadata only and no storage keys.
- Upgraded `kentos.media` from placeholder to metadata-aware processing summary with retry-safe accepted/skipped/failed reasons.
- Extended channel intake envelopes with media metadata and added attachment counts to channel analytics without moving provider business logic into the gateway.
- Implemented attachment retention in `kentos.retention` with safe dry-run defaults, explicit DB/object delete flags, storage-key reporting, and S3 `DeleteObjects` support only when enabled.
- Productized the local DB drift as an intentional `EMAIL` channel by adding the Prisma enum migration, generated schema type, shared channel schemas, and public/channel DTO allowlists without adding live email outbound.

### Evidence snapshot

- Branch/sync before commit: local `master`, `origin/master...master = 0 1`.
- Static checks: `pnpm --filter @kentos/api test=passed`, `pnpm typecheck=passed`, `pnpm build=passed`.
- Diff hygiene: `git diff --check=passed` with only expected CRLF normalization warnings.
- API surface added: `POST /api/v1/attachments/uploads`, `POST /api/v1/attachments/:id/confirm`, `POST /api/v1/public/:tenantSlug/attachments/uploads`, `POST /api/v1/public/:tenantSlug/attachments/:id/confirm`.
- API surface added for private downloads: `GET /api/v1/attachments/:id/download`, `GET /api/v1/public/:tenantSlug/attachments/:id/download?trackingToken=...`.
- Focused follow-up checks: `pnpm --filter @kentos/api test=passed`, `pnpm --filter @kentos/worker test=passed`, `pnpm --filter @kentos/shared test=passed`, `pnpm typecheck=passed`, `pnpm build=passed`.
- Local runtime smoke: `pnpm smoke:api=passed` on `http://127.0.0.1:3110/api/v1`, including admin/public attachment init-confirm-bind-download checks and public metadata storage-key leak assertions.
- Browser smoke: `pnpm exec playwright test --config=playwright.smoke.config.ts --workers=1 --reporter=list=passed` with 7/7 scenarios on QA ports `3110/3111/3112`, including real `.txt` attachment file selection.
- Follow-up worker evidence: `pnpm --filter @kentos/worker test=passed` for media processor and attachment retention dry-run/delete summaries.
- DB drift decision: `20260510130000_channel_type_email` and `20260510131500_citizen_identifier_source_email` are now in repo; local destructive reset is not required for the EMAIL enum drift.
- Browser file-upload QA: Playwright smoke now includes real `.txt` file selection for citizen report, admin internal note, and admin public message attachment paths.

### Risk and rollback

- Risk level: `medium` because storage, binding, signed download, media processing, attachment retention dry-run, API smoke, and browser smoke are covered; real deletion remains opt-in and production approval-gated.
- Rollback policy: revert the attachment productization commit if signed upload/download or binding endpoints cause runtime issues; existing ticket/message flows remain backward-compatible because `attachmentIds` stay optional.
- Retention note: `kentos.retention` includes attachment records and object-key reporting by default in dry-run mode. Actual DB delete requires `dryRun=false`; S3 object delete additionally requires `deleteAttachmentObjects=true` or `RETENTION_DELETE_ATTACHMENT_OBJECTS=true`.

## Next — Principal engineer audit hardening — 2026-05-06

### Summary

- Centralized deterministic public intake fallback classification into shared domain code consumed by both the API and AI runner.
- Fixed smoke verification drift around widget QA origins and aligned citizen dedup regression coverage with the current public intake reuse policy.
- Threaded safe admin mutation error messaging from [`ApiError.safeMessage`](apps/admin-web/lib/api.ts:19) through server-action redirects into admin notices.
- Closed the citizen identity audit with a schema-backed reconciliation ADR centered on identifier normalization, staged merge handling, and non-destructive rollout.
- Implemented the first schema-backed citizen identity slice with `CitizenIdentifier`, identifier-backed public intake resolution, conversation citizen linking, WhatsApp replay idempotency, and production fail-closed channel guards.

### Evidence snapshot

- Branch/sync: PR #3 merged to `master` in `4699c4e`; PR #4 merged the Next config cleanup in `8409c65`; local `master` is synced with `origin/master` (`origin/master...master = 0 0`).
- Static checks: `db:generate=passed`, `db:migrate=passed`, `db:seed=passed`, `typecheck=passed`, `build=passed`
- Database migration: `20260506120000_citizen_identity_reconciliation=applied locally`; `20260507133000_citizen_identity_phase3_enforcement_marker=added as no-op phase marker`
- API smoke: `passed` on `http://127.0.0.1:3110/api/v1`, including citizen identity backfill, WhatsApp ingest idempotency, widget status, conversation segments, and seeded channel analytics rows.
- Gateway verification: `typecheck=passed`, `test=passed`, and `smoke:gateway=passed` on `http://127.0.0.1:3120` for health, internal outbound auth rejection, and Meta/Twilio signature rejection.
- Browser/dev runtime: Playwright smoke `5/5 passed` on QA ports `3110/3111/3112`; Scenario L 390px mobile probe passed for admin login/settings/ticket detail and citizen report/track/ticket.
- Data-model decision: [`0002 — Citizen Identity and Reconciliation Strategy`](docs/decisions/0002-citizen-identity-reconciliation.md:1) added
- Citizen reconciliation dry-run: `passed` via [`pnpm citizen-identity:backfill`](package.json:22) with evidence saved at [`output/citizen-identity/all-tenants-dry-run.json`](output/citizen-identity/all-tenants-dry-run.json); `tenantCount=1`, `readyForPhase3=true`, `unresolvedExceptionCount=0`, `mergeCandidateCount=14`
- Citizen reconciliation controlled apply: `passed` for tenant `cmophayio0000kovgkksj6f25` with evidence at [`apps/api/output/citizen-identity/cmophayio0000kovgkksj6f25-apply.json`](apps/api/output/citizen-identity/cmophayio0000kovgkksj6f25-apply.json) and post-apply verification at [`apps/api/output/citizen-identity/cmophayio0000kovgkksj6f25-post-apply-dry-run.json`](apps/api/output/citizen-identity/cmophayio0000kovgkksj6f25-post-apply-dry-run.json); `mergeCandidateCount=0`, `manualReviewCount=0`, `readyForPhase3=true`

### Principal-engineer risk register

- P1 closed: duplicated deterministic intake logic divergence risk, remediated by [`buildDeterministicIntakeClassification()`](packages/shared/src/intake-deterministic.ts:80)
- P1 closed: smoke false-negative risk from mismatched widget QA origins in [`scripts/smoke-api.mjs`](scripts/smoke-api.mjs:719)
- P1 closed: admin operators receiving generic mutation failures instead of safe actionable notices in [`runSettingsMutation()`](apps/admin-web/app/settings/actions.ts:26) and [`runTicketMutation()`](apps/admin-web/app/tickets/actions.ts:14)
- P1 closed: citizen identity uniqueness is now schema-backed through `CitizenIdentifier`, and public/conversation intake uses the shared reconciliation service.
- P1 closed: WhatsApp/internal replay risk is reduced by `ChannelEvent` idempotency on inbound `externalMessageId`.
- P1 closed: historical citizen backfill dry-run and exception-report evidence is now produced through [`pnpm citizen-identity:backfill`](package.json:22) and archived at [`output/citizen-identity/all-tenants-dry-run.json`](output/citizen-identity/all-tenants-dry-run.json).
- P1 closed: controlled citizen merge `--apply` execution and post-apply verification are complete for tenant `cmophayio0000kovgkksj6f25`; Phase 3 is represented by the no-op enforcement marker migration because the unique index already exists in [`20260506120000_citizen_identity_reconciliation`](packages/database/prisma/migrations/20260506120000_citizen_identity_reconciliation/migration.sql:1).
- P1 closed: external WhatsApp provider signature verification helper and gateway regression checks are passing in [`apps/whatsapp-gateway/src/webhook-signatures.ts`](apps/whatsapp-gateway/src/webhook-signatures.ts:1) and [`apps/whatsapp-gateway/src/server.ts`](apps/whatsapp-gateway/src/server.ts:18).
- P1 closed: workspace-wide [`pnpm build`](package.json:8) passes, and PR #4 removed the obsolete Next `outputFileTracing` config that caused the non-fatal Next 15 warning.

### Risk and rollback

- Risk level: `low` because static checks, API smoke, gateway smoke, browser smoke, and mobile Scenario L evidence are green; remaining gates are external production/provider approvals only.
- Rollback policy: revert PR #4 (`499d59e`) if a future deployment needs an explicit Next output-tracing setting; for citizen reconciliation, keep [`docs/workflows/citizen-identity-apply-rollback-note.md`](docs/workflows/citizen-identity-apply-rollback-note.md) together with the archived dry-run/apply/post-apply artifacts as the operational rollback reference.

## Next — PDF-style assistant product wave — 2026-05-05

### Summary

- Added embeddable citizen assistant foundations: `/widget.js`, `/widget/[tenantSlug]`, WEB_CHAT ticket creation, and admin self-serve widget install code.
- Added conversation-first intake endpoints with pre-ticket state in `Conversation.context` and deterministic follow-up/ticket creation handoff.
- Added channel-neutral intake envelopes and WhatsApp internal handoff with protected `/internal/channel-ingest` plus smoke coverage.
- Added `/analytics/channels` for channel-level ticket/conversation/message/automation summary.
- Hardened public citizen endpoints with widget origin allowlist and tenant/IP rate-limit controls.

### Evidence snapshot

- Branch/sync: local `master`; product wave is committed in `971061a` and line-ending hygiene in `1f0661b`.
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
