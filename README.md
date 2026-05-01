# KentOS AI

KentOS AI is an AI-powered municipal citizen request, complaint, workflow, SLA, WhatsApp, and admin operations platform.

It is not a toy chatbot or landing page. The MVP turns citizen messages from WhatsApp, web, and manual operator entry into structured tickets, routes them to municipal departments, tracks SLA deadlines, records audit history, informs citizens, and gives managers operational visibility.

## Workspace

```text
apps/api                NestJS business API
apps/admin-web          Next.js staff/admin/manager panel
apps/citizen-web        Next.js citizen reporting and tracking UI
apps/whatsapp-gateway   WhatsApp provider adapter boundary
apps/ai-service         AI prompt/provider boundary
apps/worker             Queue processors for SLA, notifications, reports
packages/database       Prisma schema, migrations, seed
packages/shared         Shared types and validation schemas
infra                   Local infrastructure
```

## Local commands

```bash
pnpm install
pnpm db:generate
pnpm typecheck
pnpm build
```

Local infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed
```

Recommended dev ports when `3000`, `3001`, or `3002` are already occupied:

```bash
PORT=3100 pnpm --filter @kentos/api dev
pnpm --filter @kentos/admin-web dev -- -p 3101
pnpm --filter @kentos/citizen-web dev -- -p 3102
```

## Demo seed

Default demo tenant after seed:

- Tenant slug: `demo-belediye`
- Admin email: `admin@demo.local`
- Admin password: `ChangeMe123!`

Use only for local development.

## Verification standard

Before reporting a task complete, run the smallest relevant check and then the broader checks when practical:

```bash
pnpm typecheck
pnpm build
```

For database changes, also run:

```bash
pnpm db:generate
```

For UI changes, start the relevant app and perform a browser/manual smoke check when possible.

See [docs/workflows/local-smoke.md](docs/workflows/local-smoke.md) for local API smoke commands, [docs/workflows/browser-smoke.md](docs/workflows/browser-smoke.md) for manual browser-flow verification, and [docs/checklists/release-checklist.md](docs/checklists/release-checklist.md) for merge/release gates.

## Claude Code Agent OS

This project includes a local Claude Code operating system for autonomous waves, agent roles, workflow commands, hooks policy, MCP policy, parallel-session rules, and other-project installation guidance.

Start here: [docs/agent-os/README.md](docs/agent-os/README.md).
