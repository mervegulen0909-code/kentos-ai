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
- [ ] API `/health` responds locally.
- [ ] API `/health/ready` responds locally after database seed.
- [ ] No hardcoded secrets, production credentials, or real tokens are staged.

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
- [ ] Smoke verifies legacy/internal `KNT-*` ticket numbers do not work on public lookup endpoints.

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
- [ ] Admin settings supports department/category/SLA/message-template create or update flows currently in scope.
- [ ] Citizen report creates a ticket and redirects to the public ticket page under the `ticket/[trackingToken]` route.
- [ ] Citizen tracking finds the same public ticket by TK tracking code only under the `ticket/[trackingToken]` route.
- [ ] Citizen invalid ticket state is public-safe and helpful.
- [ ] Citizen pages do not expose internal notes, audit logs, AI reasoning, stack traces, secrets, or tenant internals.
- [ ] Browser console has no unexpected errors on the smoke path.
- [ ] Narrow mobile viewport has no blocking layout breakage.

### Browser status rule (strict)

- [ ] Record browser status using only: `passed`, `partial`, `blocked`, `not_run`.
- [ ] Mark browser status as `passed` only when citizen Scenarios I/J/K and mobile Scenario L are explicitly confirmed.
- [ ] If any citizen/mobile critical scenario is unconfirmed, record `partial` with explicit gap.
- [ ] Include evidence date, owner, and SLA for unresolved gaps (`partial`/`blocked`).
- [ ] Do not claim UI completion as `passed` while browser status is `partial` or `blocked`.

### Release evidence snapshot (required per cycle)

- [ ] Branch and ahead/behind count recorded.
- [ ] Static verification summary recorded (`db:generate`, `typecheck`, `build`).
- [ ] API smoke status recorded with command + result.
- [ ] Browser smoke status recorded with enum + gaps/blockers.
- [ ] Owner and SLA recorded for each open gap/blocker.
- [ ] Local-only file exclusions recorded (for example `.claude/settings.json`).
- [ ] Risk level for the cycle recorded (`low`/`medium`/`high`) with one-line reason.
- [ ] Rollback note recorded when any `partial` or `blocked` status exists.
- [ ] Merge decision state recorded (`go`/`hold`) with rationale.
- [ ] Snapshot location linked from run-log checkpoint.

### Branch/worktree housekeeping guardrail

- [ ] Merged feature branches are deleted locally and on remote unless explicitly preserved.
- [ ] Active worktree branches are not deleted while attached to another session.
- [ ] Local release operations keep `.claude/settings.json` and other local-only state out of staged release commits.
- [ ] `git status --short` is clean or intentionally documented before final release report.
- [ ] Housekeeping completion is logged in `docs/workflows/autonomous-run-log.md`.
- [ ] Owner and SLA are set for unresolved housekeeping exceptions.
## 7. Worker evidence regression

Run this scope when queue processors, notification delivery guardrails, or worker-local operational summaries change.

- [ ] `pnpm --filter @kentos/worker typecheck`
- [ ] Notification processor returns explicit skip reasons for non-deliverable public-message jobs.
- [ ] SLA processor returns actionable `breached` and `dueSoon` counts with a timestamped summary.
- [ ] Reports processor returns a timestamped acceptance summary suitable for QA/release evidence.

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

Before push:

- [x] Confirm branch name and target remote. Latest local evidence: current branch is `wave/tk-ai-smoke-hardening-20260504`, target remote is `origin`, and PR base/head is `master <- wave/tk-ai-smoke-hardening-20260504` (`gh pr view 1 --json headRefName,baseRefName,state,url`, 2026-05-04).
- [x] Confirm final verification results. Latest local evidence: final static verification remained passed (`pnpm typecheck`, `pnpm build` on 2026-05-04), API smoke passed on 2026-05-04, and browser status remains explicitly `partially run with gaps` with runtime readiness reconfirmed (`200/200/200`).
- [x] Confirm `git status --short` contains only intentional changes. Latest local evidence: only local `.claude/settings.json` remains unstaged and intentionally excluded from release/docs commits; branch content for PR is intentional.
- [x] Confirm no secrets or production env files are staged. Latest local evidence: no `.env*`, credentials, or production secret files are staged; policy remains `.env*` ignored.
- [x] Confirm whether the action is branch push only or PR creation/update. Latest local evidence: branch push and PR update were performed for PR #1 (`https://github.com/filizgulen1966-tech/kentos-ai/pull/1`).

## 10. Final merge note

Record the final note with:

- [x] Branches merged and order. Latest local evidence: this release candidate is prepared on `wave/tk-ai-smoke-hardening-20260504` and opened as PR #1 into `master`; no additional branch merge chain is required before PR review/merge.
- [x] Conflicts and how they were resolved. Latest local evidence: no unresolved merge conflicts remain in the current PR branch.
- [x] Verification commands and pass/fail results. Latest local evidence: `pnpm db:generate` passed, `pnpm typecheck` passed, `pnpm build` passed, API health/runtime probes passed, and docs record browser status as partial with explicit gaps.
- [x] API smoke result or reason it was not run. Latest local evidence: API smoke passed on 2026-05-04 (`DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api`).
- [x] Browser smoke result or reason it was not run. Latest local evidence: `partially run with gaps`; runtime readiness reconfirmed (`3110/3111/3112 -> 200/200/200`), full manual scenario set not yet fully re-run in this cycle.
- [x] Remaining blockers and owner. Latest local evidence: only blocker is full manual browser scenario coverage for strict `passed` sign-off; owner is `1 — Ana Kontrol` / release control window.
