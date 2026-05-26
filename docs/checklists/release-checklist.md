# Release and Merge Checklist

Use this checklist before merging wave branches into `master` and before publishing a release candidate. It assumes local-only QA unless the user explicitly approves push/deploy.

## 1. Branch merge order

- [ ] Confirm `master` is the integration branch.
- [ ] Confirm the GitHub remote is the expected repo: `origin https://github.com/filizgulen1966-tech/kentos-ai.git`.
- [ ] Check `git status --short` and identify any uncommitted work before merging.
- [ ] If reusing a branch that was already merged, align it with current local `master` before new edits.
- [ ] Merge API/database/contracts branches first.
- [ ] Merge frontend branches after the API shape they consume is merged.
- [ ] Merge QA/docs/smoke branches after implementation branches so docs match final behavior.
- [ ] Merge security/review-only branches last, if present.
- [ ] Merge one branch at a time; do not batch unrelated branches into a single unresolved conflict set.

## 2. Conflict resolution

- [ ] Inspect every conflicted file before editing.
- [ ] Preserve tenant scoping, RBAC guards, public-safe response boundaries, and audit logging when resolving code conflicts.
- [ ] For docs conflicts, keep the wording that matches the final verified behavior rather than the newest timestamp.
- [ ] Do not resolve conflicts by deleting broad sections unless the owning window's handoff explicitly says they are obsolete.
- [ ] Do not use destructive cleanup commands without explicit user approval.
- [ ] After resolving conflicts, run the smallest relevant check for the touched area before continuing.

## 3. Required verification

- [ ] `pnpm db:generate`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] Canonical local gate is recorded in this order: `pnpm db:generate`, targeted unit tests, `pnpm typecheck`, `pnpm build`, `git diff --check`, optional Playwright discovery/full run, then `pnpm ops:preflight -- --with-verification`.
- [ ] `pnpm ops:preflight` reports no blocked gates before any production approval meeting.
- [ ] `pnpm ops:preflight -- --strict-launch` reports no blocked gates before declaring the product ready for end users.
- [ ] API `/health` responds locally.
- [ ] API `/health/ready` responds locally after database seed.
- [ ] No hardcoded secrets, production credentials, or real tokens are staged.
- [ ] If `pnpm` is not on `PATH`, bootstrap note is followed (`corepack enable` + new terminal, or `npm run <root-script>` / `npm.cmd run <root-script>` for Node-backed root entrypoints only).
- [ ] If the production VPS scaffold (`infra/docker-compose.prod.yml`) is part of the release: DNS for API/admin/citizen/gateway plus any `MUNICIPALITY_DOMAIN` is in place; `.env.production.local` was generated via `pnpm infra:prod:bootstrap` and reviewed; `CITIZEN_SESSION_SECRET`, `INTERNAL_EVENTS_KEY`, Firebase client build values and Firebase API credential are configured; `pnpm ops:external -- --strict-launch` has no blocked gates. Safety defaults (`*_OUTBOUND_LIVE=false`, `RETENTION_DRY_RUN=true`, `ATTACHMENT_SCAN_PROVIDER=placeholder`) may be used while provisioning only; final launch requires healthy ClamAV and `ATTACHMENT_SCAN_PROVIDER=clamav`. See `docs/workflows/production-infra-runbook.md`.

## 4. API smoke

Run local API smoke when API, database, auth, RBAC, tenant settings, ticket workflow, audit, or public citizen endpoints changed.

- [ ] Local Docker infra is running.
- [ ] Local database migration and seed completed.
- [ ] Local API is running on a QA port, preferably `3110`.
- [ ] `KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api`
- [ ] Smoke verifies health/readiness.
- [ ] Smoke verifies demo admin login.
- [ ] Smoke verifies tenant settings write/read.
- [ ] Smoke verifies authenticated ticket create, assignment, internal note, public message, status transition, and audit log.
- [ ] Smoke verifies public citizen ticket create and TK tracking-code lookup.
- [ ] Automated account-security coverage rejects missing/forged citizen erasure session tokens and permits deletion only for a signed-in disposable QA citizen.
- [ ] Smoke verifies legacy/internal `KNT-*` ticket numbers do not work on public lookup endpoints.
- [ ] Smoke verifies WhatsApp/internal channel ingest rejects missing internal key and accepts authorized text-only envelope handoff.
- [ ] Smoke verifies public widget/ticket endpoint rejects disallowed `Origin` and accepts allowlisted widget origin.
- [ ] Smoke verifies admin/public attachment presign-init, checksum confirm, ticket/message binding, and signed download contract.
- [ ] Smoke verifies public attachment metadata does not include storage keys, permanent object URLs, internal notes, audit logs, AI reasoning, or staff-only fields.
- [ ] Smoke verifies `/public/:tenantSlug/widget-status` returns `widgetReady`, `originAllowed`, and `allowedOriginCount` for the seeded tenant.
- [ ] Smoke verifies `/analytics/conversation-segments` returns `aiCompleted / operatorHandoff / awaitingInfo / automationRate`.
- [ ] Smoke verifies `/analytics/channels` returns rows for at least the seeded channels (WEB_CHAT, WHATSAPP, INSTAGRAM, FACEBOOK, SMS; EMAIL is accepted without requiring demo data) and includes attachment counts when media is linked.
- [ ] Smoke verifies `/analytics/outbound-deliveries` returns delivery totals, channel breakdowns, and recent failure review rows without citizen contact fields.
- [ ] Smoke verifies internal outbound endpoints (`/internal/<channel>/outbound`) on the gateway reject missing `x-kentos-internal-key`.
- [ ] Smoke verifies multi-channel webhook intake (`/webhooks/instagram`, `/webhooks/facebook`, `/webhooks/sms`) rejects missing `META_APP_SECRET` / `TWILIO_AUTH_TOKEN` signatures when those env vars are configured.

## 5. Role and RBAC regression

Run role regression when auth, RBAC guards, seed users, ticket workflow, settings permissions, or admin UI affordances changed.

- [ ] `TENANT_ADMIN` can perform tenant settings writes and ticket mutations while remaining tenant-scoped.
- [ ] `READ_ONLY` can read permitted admin data but cannot write settings, create/mutate tickets, add notes/messages, or change statuses.
- [ ] `DEPARTMENT_STAFF` can access only assigned-department ticket scope and cannot mutate cross-department tickets.
- [ ] `OPERATOR` can perform only explicitly allowed intake/triage actions and cannot perform tenant-admin or manager-only actions.
- [ ] `MANAGER` can read operational/reporting views and only the workflow actions granted by product policy.
- [ ] Denied actions return safe notices/responses without stack traces, raw internal errors, secrets, tokens, or cross-tenant data.
- [ ] Allowed and denied role actions have the expected audit behavior documented in the QA report.

## 6. Manual browser smoke

Run browser smoke when admin or citizen UI routes, forms, auth/session, settings, ticket pages, or report/track flows changed.

- [ ] Admin login works with seeded tenant credentials.
- [ ] Admin dashboard renders without raw API errors.
- [ ] Admin ticket list renders rows or designed empty state.
- [ ] Admin ticket detail supports assignment, internal note, public message, status transition, refresh persistence, and audit timeline.
- [ ] Admin ticket detail supports internal/public message attachment upload and shows linked attachment metadata without storage keys.
- [ ] Admin settings supports department/category/SLA/message-template create or update flows currently in scope.
- [ ] Admin settings shows tenant-specific widget embed script, preview path, expected `WEB_CHAT` channel, and production origin/rate-limit caveat.
- [ ] Admin reports shows outbound delivery totals, failed delivery count, and channel-level delivery breakdown.
- [ ] Citizen widget preview opens at `/widget/[tenantSlug]`, submits via conversation flow, and returns either follow-up or TK tracking state without raw errors.
- [ ] Citizen widget preview can continue the same `conversationId` after a follow-up question and complete to a TK tracking state.
- [ ] Citizen widget preview supports public-safe attachment upload in the ticket-creation path without exposing storage internals.
- [ ] Citizen report creates a ticket, can attach a file, and redirects to the public ticket page under the `ticket/[trackingToken]` route.
- [ ] Citizen tracking finds the same public ticket by TK tracking code only under the `ticket/[trackingToken]` route and shows safe attachment metadata.
- [ ] Citizen invalid ticket state is public-safe and helpful.
- [ ] Citizen pages do not expose internal notes, audit logs, AI reasoning, stack traces, secrets, or tenant internals.
- [ ] Browser console has no unexpected errors on the smoke path.
- [ ] Narrow mobile viewport has no blocking layout breakage.
- [ ] Automated mobile smoke covers admin settings/reports/ticket detail plus citizen report/track/ticket at 390px without horizontal overflow.

### Browser status rule (strict)

- [ ] Record browser status using only: `passed`, `partial`, `blocked`, `not_run`.
- [ ] Mark browser status as `passed` only when citizen Scenarios I/J/K and mobile Scenario L are explicitly confirmed.
- [ ] If any citizen/mobile critical scenario is unconfirmed, record `partial` with explicit gap.
- [ ] Include evidence date, owner, and SLA for unresolved gaps (`partial`/`blocked`).
- [ ] Do not claim UI completion as `passed` while browser status is `partial` or `blocked`.

### Release evidence snapshot (required per cycle)

- [ ] Branch and ahead/behind count recorded.
- [ ] Static verification summary recorded (`db:generate`, `typecheck`, `build`).
- [ ] API smoke status recorded with command + result, including channel ingest and origin guard coverage when public/widget endpoints changed.
- [ ] UI E2E status recorded with command + CI job result (`ui-e2e`).
- [ ] Browser smoke status recorded with enum + gaps/blockers; widget/admin-install UI changes require explicit browser note.
- [ ] Owner and SLA recorded for each open gap/blocker.
- [ ] Local-only file exclusions recorded (for example `.claude/settings.json`).
- [ ] Local-only account/browser state is excluded: `.accounts.local.md`, `.accounts.machine.env`, `.api-keys.local.env`, `.browser-profiles/`, and `verification-report.txt`.
- [ ] Committed operator helpers are intentional and documented: `scripts/open-*.ps1`, `scripts/headless-*.ps1`, `scripts/setup-ai-accounts.mjs`, and `docs/accounts/**` are not runtime dependencies.
- [ ] Risk level for the cycle recorded (`low`/`medium`/`high`) with one-line reason.
- [ ] Rollback note recorded when any `partial` or `blocked` status exists.
- [ ] Merge decision state recorded (`go`/`hold`) with rationale.
- [ ] Snapshot location linked from run-log checkpoint.

### Branch/worktree housekeeping guardrail

- [ ] Merged feature branches are deleted locally and on remote unless explicitly preserved.
- [ ] Active worktree branches are not deleted while attached to another session.
- [ ] Local release operations keep `.claude/settings.json` and other local-only state out of staged release commits.
- [ ] Root example/local helper files are intentionally classified: tracked docs under `docs/accounts/**`, ignored local notes under repo-root dotfiles, and operator launcher scripts under `scripts/`.
- [ ] `git status --short` is clean or intentionally documented before final release report.
- [ ] Housekeeping completion is logged in `docs/workflows/autonomous-run-log.md`.
- [ ] Owner and SLA are set for unresolved housekeeping exceptions.
## 7. Worker evidence regression

Run this scope when queue processors, notification delivery guardrails, or worker-local operational summaries change.

- [ ] `pnpm --filter @kentos/worker typecheck`
- [ ] Notification processor returns explicit skip reasons for non-deliverable public-message jobs.
- [ ] SLA processor returns actionable `breached` and `dueSoon` counts with a timestamped summary.
- [ ] Reports processor returns a timestamped acceptance summary suitable for QA/release evidence.
- [ ] Outbound processor (`kentos.outbound`) honors retry/backoff, increments attempts once per worker failure, records `lastError`, and writes terminal `OutboundDelivery.state` (`DISPATCHED`, `FAILED`, `SKIPPED`).
- [ ] Retention processor (`kentos.retention`) accepts `tenantId / retentionDays / scope`, includes `attachments` in scope/all summaries, defaults to dry-run, and reports `attachmentStorageKeys`, `totals.attachments`, `totals.attachmentObjectsDeleted`, and `objectDeleteErrors`.
- [ ] Media processor (`kentos.media`) accepts confirmed attachment payloads, verifies object metadata when S3 is configured, returns retry-safe skip/failure reasons, and documents virus scanning as a placeholder independent from retention.

## 7.5 Channel gateway HTTP regression

Run this scope when the gateway HTTP server (`apps/whatsapp-gateway/src/server.ts`), provider parsers, or webhook signature helpers change.

- [ ] `pnpm --filter @kentos/whatsapp-gateway typecheck`
- [ ] `pnpm --filter @kentos/whatsapp-gateway test`
- [ ] `GET /health` on the gateway returns 200 with timestamp.
- [ ] Webhook endpoints `/webhooks/{whatsapp|instagram|facebook|sms}` reject when the corresponding signature env (`META_APP_SECRET` / `TWILIO_AUTH_TOKEN`) is set and the header is missing or wrong.
- [ ] Internal outbound endpoints `/internal/{channel}/outbound` reject when `x-kentos-internal-key` does not match `INTERNAL_API_KEY`.
- [ ] Internal outbound endpoints honor `*_OUTBOUND_LIVE` env flag (default dry-run + structured log; `true` invokes provider.sendText).

## 8. QA Smoke Runner window behavior

- [ ] QA window only edits allowed docs/checklists/workflow files unless separately authorized.
- [ ] QA window does not modify `apps/**`, `packages/**`, `scripts/smoke-api.mjs`, production env files, or secrets.
- [ ] QA, API, and UI worker windows do not commit; commits are created only by `1 — Ana Kontrol` unless that window explicitly delegates a one-off exception.
- [ ] QA window records commands, results, skipped checks, and blockers.
- [ ] If the same smoke failure repeats twice, QA stops and reports a root-cause hypothesis instead of changing app code.
- [ ] UI completion claims include browser/manual smoke status or an explicit note that it was not run.

## 9. Push gate

Do not push unless the user explicitly asks for it. The default team policy is milestone-end push, not push-after-each-merge.

- [x] It is acceptable for local `master` to be ahead of `origin/master` while a milestone is still in progress. Latest local evidence: temporary ahead state was used only during PR preparation and was closed after PR merge/pullback to sync.
- [x] Record merge order and verification locally, then wait for the milestone-end push decision. Latest local evidence: verification and release notes are recorded in `docs/workflows/autonomous-run-log.md`, and PR #1 merge order is documented.

### Milestone push final gate

Before the milestone push decision:

- [x] Record `git rev-list --left-right --count origin/master...master` output for the final `master` ahead count. Latest local evidence: `0 0` on 2026-05-04 after PR #1 merge sync.
- [x] Confirm `pnpm typecheck` passed on final `master`. Latest local evidence: passed on 2026-05-04.
- [x] Confirm `pnpm build` passed on final `master`. Latest local evidence: passed on 2026-05-04.
- [x] Record API smoke as passed, or record a precise blocked reason such as `Docker daemon unavailable`. Latest local evidence: passed on 2026-05-04 with `DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api`.
- [x] Record browser smoke status: passed, partially run with gaps, blocked, or explicitly not run. Latest local evidence: passed on 2026-05-04 — citizen I/J/K strict contract checks were re-verified (`public create 201`, `TK track 200`, invalid/malformed/KNT lookups `404`, citizen page `200`, `pnpm --filter @kentos/citizen-web test` passed) and Scenario L (390px + focus-visible/keyboard) was explicitly confirmed as passed by `1 — Ana Kontrol`.
- [x] Confirm `git status --short` contains only intentional state. Latest local evidence: broad intended product/docs diff plus untracked Roo mode files that must be explicitly included or ignored before commit.
- [x] Confirm no secrets, production env files, credentials, or real tokens are staged. Latest local evidence: no staging performed; `.env*` remains ignored by policy.
- [x] Confirm local tool cache directories such as `.codex/` and `.playwright-mcp/` are ignored or otherwise not staged. Latest local evidence: `.gitignore` now includes `.roo/` and `.roomodes`, and `git status --short` no longer shows those Roo local files as untracked (2026-05-04).

### 2026-05-08 repo-ready local gate

- [x] Local `master` ahead count is recorded: `origin/master...master = 0 0` after PR #3 and PR #4 merge sync.
- [x] Product wave commits are recorded: `971061a` (`feat: harden multi-channel municipal operations`), `1f0661b` (`chore: normalize text line endings`), `c185a58` (`test: close repo-ready smoke evidence`), and `07521c9` (`chore: sync lockfile for api dependency`).
- [x] Static verification passed: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm typecheck`, and `pnpm build` on local infra.
- [x] Focused checks passed: `pnpm --filter @kentos/whatsapp-gateway test`, `pnpm --filter @kentos/shared test`, `pnpm --filter @kentos/worker typecheck`, and `git diff --check`.
- [x] API smoke passed on `http://127.0.0.1:3110/api/v1`, including widget status, conversation segment analytics, seeded channel analytics rows, WhatsApp ingest idempotency, role matrix, audit, and public-safe response checks.
- [x] Gateway smoke passed on `http://127.0.0.1:3120`, including health, internal outbound auth rejection, Meta signature rejection, and Twilio signature rejection.
- [x] Browser smoke passed: Playwright smoke `5/5` on QA ports `3110/3111/3112`.
- [x] Strict mobile Scenario L passed at 390px for admin login/settings/ticket detail and citizen report/track/ticket with no horizontal overflow and visible keyboard focus targets.
- [x] Local release evidence artifacts are excluded by `.gitignore`: `/output/`, `/apps/api/output/`, `/admin-home-*.png`, and `/citizen-home-*.png`.
- [x] PR #3 merged in `4699c4e`; PR #4 merged in `8409c65`; production deploy remains out of scope until separately approved.

Before push:

- [x] Confirm branch name and target remote. Latest local evidence: current branch is `wave/tk-ai-smoke-hardening-20260504`, target remote is `origin`, and PR base/head is `master <- wave/tk-ai-smoke-hardening-20260504` (`gh pr view 1 --json headRefName,baseRefName,state,url`, 2026-05-04).
- [x] Confirm final verification results. Latest local evidence: final static verification remained passed (`pnpm typecheck`, `pnpm build` on 2026-05-04), API smoke passed on 2026-05-04, and browser status is `passed` with strict citizen I/J/K + Scenario L confirmation recorded.
- [x] Confirm `git status --short` contains only intentional changes. Latest local evidence: only local `.claude/settings.json` remains unstaged and intentionally excluded from release/docs commits; branch content for PR is intentional.
- [x] Confirm no secrets or production env files are staged. Latest local evidence: no `.env*`, credentials, or production secret files are staged; policy remains `.env*` ignored.
- [x] Confirm whether the action is branch push only or PR creation/update. Latest local evidence: branch push and PR update were performed for PR #1 (`https://github.com/filizgulen1966-tech/kentos-ai/pull/1`).

## 10. Final merge note

Record the final note with:

- [x] Branches merged and order. Latest local evidence: this release candidate is prepared on `wave/tk-ai-smoke-hardening-20260504` and opened as PR #1 into `master`; no additional branch merge chain is required before PR review/merge.
- [x] Conflicts and how they were resolved. Latest local evidence: no unresolved merge conflicts remain in the current PR branch.
- [x] Verification commands and pass/fail results. Latest local evidence: `pnpm db:generate` passed, `pnpm typecheck` passed, `pnpm build` passed, API health/runtime probes passed, strict citizen contract checks passed, and Scenario L explicit confirmation moved browser status to `passed`.
- [x] API smoke result or reason it was not run. Latest local evidence: API smoke passed on 2026-05-04 (`DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api`).
- [x] Browser smoke result or reason it was not run. Latest local evidence: `passed` with citizen I/J/K evidence and explicit Scenario L (390px + focus-visible/keyboard) confirmation.
- [x] Remaining blockers and owner. Latest local evidence: no functional release blocker; platform-only blocker remains branch protection API enforcement (`403`) and is tracked as governance follow-up by `1 — Ana Kontrol`.
