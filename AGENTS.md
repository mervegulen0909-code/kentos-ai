# Agent Instructions for KentOS AI

## Project goal

KentOS AI is a municipal operations platform for citizen requests, complaints, workflows, SLA tracking, WhatsApp automation, AI intake, and admin analytics.

## Stack

- Package manager: pnpm workspaces
- API: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Queue: Redis/BullMQ
- Admin web: Next.js App Router
- Citizen web: Next.js App Router
- Storage: S3-compatible object storage
- Maps: OpenStreetMap/Leaflet planned

## Commands

```bash
pnpm install
pnpm db:generate
pnpm typecheck
pnpm build
pnpm --filter @kentos/api dev
pnpm --filter @kentos/admin-web dev -- -p 3101
pnpm --filter @kentos/citizen-web dev -- -p 3102
```

Local infra:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
```

## Agent behavior rules

- Read existing files before editing.
- State assumptions when requirements are ambiguous.
- Keep changes surgical and tied to the current task.
- Avoid speculative abstractions and drive-by refactors.
- Do not hardcode municipality-specific routing rules in business logic; use tenant config and seed data.
- Keep WhatsApp business logic out of the gateway. The gateway only normalizes provider events and sends provider messages.
- Do not expose internal notes, AI reasoning, or staff-only fields to citizens.
- Audit every meaningful ticket mutation.

## Files agents may edit freely

- `apps/**`
- `packages/**`
- `docs/**`
- `.interface-design/**`
- `infra/docker-compose.yml`
- root workspace config files

## Approval gates

Pause before:

- deleting or overwriting user data
- killing unrelated processes
- production deploys
- public publishing
- changing secrets or credentials
- billing or paid compute changes
- destructive data operations
- irreversible migrations
- large model/data downloads
- sending external messages

## Orchestrator / worker protocol

Worker tasks must be narrow, file-scoped, and verifiable. Use this format:

```text
Worker task:
- Role:
- Goal:
- Scope:
- Files allowed:
- Files forbidden:
- Inputs to read:
- Exact steps:
- Constraints:
- Output expected:
- Verification command:
- Stop conditions:
- Escalation trigger:
```

Review worker output for scope fit, correctness, simplicity, safety, maintainability, tests, UX/design, integration, and diff hygiene.

## Final verification standard

At minimum, run:

```bash
pnpm typecheck
pnpm build
```

Add `pnpm db:generate` for Prisma/schema work. Add local HTTP/browser smoke checks for API/UI work when servers are running.
