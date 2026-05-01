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
- Public citizen ticket create and public-safe ticket tracking.
- Public responses do not leak internal notes, audit logs, AI reasoning, tokens, or tenant internals.

The smoke must not call non-local endpoints, send WhatsApp/email/social messages, deploy, push, or mutate production data.

## Start local infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

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

Track the created ticket by ticket number:

```bash
curl http://127.0.0.1:3110/api/v1/public/demo-belediye/tickets/<ticketNo>
```

## Full local verification

Run the broad checks before a merge or final report when practical:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

If `pnpm build` takes too long or is blocked by an unrelated in-progress change, stop and report the exact blocker instead of claiming completion.

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
