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
- [ ] Smoke verifies public citizen ticket create/track.

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
- [ ] Citizen report creates a ticket and redirects to the public ticket page.
- [ ] Citizen tracking finds the same ticket by ticket number.
- [ ] Citizen invalid ticket state is public-safe and helpful.
- [ ] Citizen pages do not expose internal notes, audit logs, AI reasoning, stack traces, secrets, or tenant internals.
- [ ] Browser console has no unexpected errors on the smoke path.
- [ ] Narrow mobile viewport has no blocking layout breakage.

## 7. QA Smoke Runner window behavior

- [ ] QA window only edits allowed docs/checklists/workflow files unless separately authorized.
- [ ] QA window does not modify `apps/**`, `packages/**`, `scripts/smoke-api.mjs`, production env files, or secrets.
- [ ] QA, API, and UI worker windows do not commit; commits are created only by `1 — Ana Kontrol` unless that window explicitly delegates a one-off exception.
- [ ] QA window records commands, results, skipped checks, and blockers.
- [ ] If the same smoke failure repeats twice, QA stops and reports a root-cause hypothesis instead of changing app code.
- [ ] UI completion claims include browser/manual smoke status or an explicit note that it was not run.

## 8. Push gate

Do not push unless the user explicitly asks for it. The default team policy is milestone-end push, not push-after-each-merge.

- [ ] It is acceptable for local `master` to be ahead of `origin/master` while a milestone is still in progress.
- [ ] Record merge order and verification locally, then wait for the milestone-end push decision.

Before push:

- [ ] Confirm branch name and target remote.
- [ ] Confirm final verification results.
- [ ] Confirm `git status --short` contains only intentional changes.
- [ ] Confirm no secrets or production env files are staged.
- [ ] Confirm whether the action is branch push only or PR creation/update.

## 9. Final merge note

Record the final note with:

- [ ] Branches merged and order.
- [ ] Conflicts and how they were resolved.
- [ ] Verification commands and pass/fail results.
- [ ] API smoke result or reason it was not run.
- [ ] Browser smoke result or reason it was not run.
- [ ] Remaining blockers and owner.
