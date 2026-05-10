# Local Smoke Workflow

This workflow verifies the local KentOS API surface without changing application code. Use it after API, database, RBAC, tenant-settings, ticket-workflow, or public citizen-flow changes.

## Scope covered by `pnpm smoke:api`

The current smoke script verifies:

- API `/health` and `/health/ready`.
- Demo admin login for tenant `demo-belediye`.
- Authenticated tenant config reads for departments, categories, neighborhoods, SLA policies, and message templates.
- Tenant settings write/read through authenticated admin API.
- RBAC negative checks for settings writes and department-scoped ticket access.
- Ticket transition guard checks for invalid or repeated status changes.
- Authenticated ticket create, assignment, internal note, public message, status transition, and audit-log read.
- Audit coverage checks for ticket assignment, notes, public messages, status transitions, and denied mutations where applicable.
- Public citizen ticket create and public-safe TK tracking-code lookup.
- Public tracking is TK-only: `KNT-*` internal ticket numbers must not work on public lookup endpoints.
- Public responses do not leak internal notes, audit logs, AI reasoning, internal ticket numbers, IDs, tokens, or tenant internals.
- Admin ticket detail now surfaces an AI intake summary with classification confidence, intent, suggested routing, missing fields, and follow-up prompt context for staff-only triage.

The smoke must not call non-local endpoints, send WhatsApp/email/social messages, deploy, push, or mutate production data.

Worker evidence notes for the current local verification baseline:

- Notification worker verification currently means `pnpm --filter @kentos/worker typecheck` passes and the processor returns explicit skip reasons for non-deliverable public-message jobs.
- SLA worker verification currently means the processor reports timestamped counts for actionable tickets that are already breached or due within the next hour.
- Reports worker verification currently means the processor returns an evidence-friendly timestamped acceptance summary for local QA and release reporting.

## Start local infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Docker Desktop blocker

If Docker Desktop or the Docker daemon is not running, local API smoke cannot be marked as passed. Treat this as **blocked**, not failed and not passed.

How to identify the blocker:

- `docker compose -f infra/docker-compose.yml up -d` cannot connect to the Docker daemon.
- Docker CLI output mentions that the daemon is unavailable, Docker Desktop is not running, or the named pipe/socket cannot be reached.
- Database-dependent commands fail because the local Postgres container never started.

How to report it:

- Record the exact command that hit the Docker blocker.
- Report API smoke as `blocked: Docker daemon unavailable`.
- Do not claim `pnpm smoke:api` passed unless the local API was actually running and the smoke command completed successfully.
- Continue with non-Docker checks such as `pnpm typecheck` and `pnpm build` when they are not blocked by the same issue.

## Prepare the database

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:generate
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:migrate
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:seed
```

Seeded local demo credentials:

- Tenant: `demo-belediye`
- Email: `admin@demo.local`
- Password: `ChangeMe123!`

## Start the API

Prefer port `3110` for QA windows so the default app ports remain available to feature windows:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
```

If `3110` is occupied by another workspace-owned API process, choose another localhost port and pass it to the smoke command. Do not kill unrelated processes.

## Run API smoke

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

If API smoke fails, retry only after changing the condition that caused the failure: start Docker Desktop, start the local API, regenerate Prisma client, migrate/seed the database, or update `KENTOS_API_BASE_URL` to the actual localhost port. Do not rerun the same failing command repeatedly without a changed condition. If the same smoke failure repeats twice, stop and report the command, changed condition, last error, and root-cause hypothesis.

Quick health probes while the API is running:

```bash
curl http://127.0.0.1:3110/api/v1/health
curl http://127.0.0.1:3110/api/v1/health/ready
curl http://127.0.0.1:3110/api/docs
```

## RBAC negative smoke

Run this scope when auth, RBAC, tenant settings, ticket workflow, department scoping, seed roles, or public response boundaries change. The automated smoke should prove that:

- A seeded read-only user can authenticate but cannot write tenant settings.
- Department staff can see and mutate only tickets assigned to their department scope.
- Cross-department ticket reads or mutations return a safe denial or not-found response.
- Public ticket responses never include internal notes, audit entries, AI reasoning, staff-only IDs, secrets, or tokens.
- Negative responses are explicit enough for QA diagnosis but do not expose stack traces or raw internal errors.

If any RBAC negative case fails twice, stop and report the exact role, endpoint, expected denial, and actual response before changing any app code.

## Role matrix smoke expectations

Run this scope when seed roles, guards, ticket workflow permissions, tenant settings permissions, or admin UI affordances change. The smoke result should make each role's allowed and denied actions explicit:

| Role | Expected positive checks | Expected negative checks |
| --- | --- | --- |
| `TENANT_ADMIN` | Can authenticate, read tenant config, write tenant settings, create/assign/mutate tickets, add internal notes and public messages, read audit logs. | Must remain tenant-scoped and must not access another tenant's data. |
| `READ_ONLY` | Can authenticate and read allowed admin data for the tenant. | Cannot write tenant settings, create or mutate tickets, add notes/messages, or change statuses. Denials must be safe and non-mutating. |
| `DEPARTMENT_STAFF` | Can read and mutate tickets assigned to its department scope when the transition/action is otherwise valid. | Cannot read or mutate cross-department tickets and cannot bypass status transition guards. |
| `OPERATOR` | Can perform front-line ticket intake/triage actions that are explicitly in scope, such as ticket creation or permitted updates. | Cannot perform tenant-admin settings writes, privileged RBAC changes, or manager-only actions. |
| `MANAGER` | Can read operational views and reports, and can perform manager-approved workflow actions if implemented. | Cannot perform tenant-admin-only settings/RBAC changes unless explicitly granted by product policy. |

For each role, record the login identity used, endpoint or UI action, expected status/result, actual status/result, and whether an audit entry should exist.

## Ticket transition guards

Run this scope when ticket status logic, controller guards, role permissions, or UI transition buttons change. The automated smoke should prove that:

- A valid next transition succeeds for the seeded admin.
- Repeating a transition that is no longer valid returns a safe validation or conflict response.
- Skipping required intermediate statuses is denied unless the workflow explicitly allows it.
- Department-scoped users cannot transition tickets outside their assigned department scope.
- Denied transition responses do not create misleading success messages or partial ticket state changes.

If transition guard behavior is uncertain, report the current status, attempted target status, role, endpoint, expected result, and actual response.

## Audit coverage smoke

Run this scope when ticket mutations, audit writers, or public/private message boundaries change. The automated smoke should prove that:

- Ticket creation, assignment, internal note, public message, and status transition each create an audit entry.
- Audit entries include enough actor/action/timestamp context for staff diagnosis.
- Denied mutations either create no audit entry or create an intentional security-relevant audit entry; document which behavior is expected.
- Citizen public tracking never returns audit entries or internal notes.
- Audit read failures are reported as QA blockers and are not masked by editing smoke expectations.

## AI intake and TK-only regression evidence

For the current AI/TK-only baseline, contract and parser regression coverage means:

- `pnpm --filter @kentos/api typecheck` passes after keeping `aiSummary` staff-only on ticket detail.
- `pnpm --filter @kentos/admin-web typecheck` passes after rendering the admin-side AI intake summary card.
- `pnpm --filter @kentos/shared test` prints `shared intake schema tests passed` and proves valid intake payloads parse while invalid email, unsupported `missingFields`, out-of-range confidence, and legacy `KNT-*` status references are rejected.
- `pnpm --filter @kentos/citizen-web test` prints `track actions checks passed` and proves citizen tracking redirects only canonical TK tokens while rejecting malformed and legacy internal ticket numbers.

## Manual endpoint probes

Login:

```bash
curl -s -X POST http://127.0.0.1:3110/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"tenantSlug":"demo-belediye","email":"admin@demo.local","password":"ChangeMe123!"}'
```

Create a public citizen ticket:

```bash
curl -s -X POST http://127.0.0.1:3110/api/v1/public/demo-belediye/tickets \
  -H 'Content-Type: application/json' \
  -d '{"description":"Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü.","phone":"+905551112233","addressText":"Atatürk Mahallesi 12. Sokak"}'
```

Track the created ticket by TK tracking code:

```bash
curl http://127.0.0.1:3110/api/v1/public/demo-belediye/tickets/<trackingToken>
```

Legacy/internal `KNT-*` ticket numbers are not valid public tracking identifiers and should return a safe invalid/not-found response.

## Full local verification

Run the broad checks before a merge or final report when practical:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

If `pnpm build` takes too long or is blocked by an unrelated in-progress change, stop and report the exact blocker instead of claiming completion.

## Evidence status contract

Use this status enum for local smoke evidence:

- `passed`: completed with expected result
- `partial`: partially completed with explicit gaps
- `blocked`: could not complete due to external blocker
- `not_run`: intentionally not executed in this cycle

Every local smoke checkpoint must include:

- Status
- Evidence date
- Owner
- SLA (required when status is `partial` or `blocked`)
- Exact verification command(s)
- One-line result and remaining gap/blocker summary

No checkpoint should be marked as `passed` when required checks are unknown or unconfirmed.

## QA Smoke Runner window rules

A QA Smoke Runner window verifies and documents; it does not develop features.

Allowed actions:

- Edit smoke, release, Agent OS, decision, checklist, README, and workflow docs inside the assigned docs scope.
- Run local-only verification commands, API smoke, and browser smoke checklists.
- Start local dev servers on alternate localhost ports.
- Stop only workspace-owned dev processes started for the smoke run.
- Record exact commands, pass/fail state, blockers, and merge notes in docs or the final report.

Forbidden actions:

- Modify API/UI/package implementation files, including `apps/**`, `packages/**`, and `scripts/smoke-api.mjs`.
- Change production secrets, deploy, push, publish, or send external messages.
- Kill unrelated processes or perform destructive cleanup.
- Mask a repeated smoke failure by editing the smoke script or app code from the QA window.

If a failure repeats twice, stop and report the most likely root cause, the command used, and the last relevant error output.
