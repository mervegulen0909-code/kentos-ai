# KentOS AI

KentOS AI is an AI-powered municipal citizen request, complaint, workflow, SLA, WhatsApp, embeddable web assistant, and admin operations platform.

It is not a toy chatbot or landing page. The MVP turns citizen messages from WhatsApp, web, embeddable WEB_CHAT widget, and manual operator entry into structured tickets, routes them to municipal departments, tracks SLA deadlines, records audit history, informs citizens, and gives managers operational visibility.

## What is included

- **Citizen intake:** public report form, TK-only public tracking, citizen-safe ticket detail, and an embeddable widget shell at `/widget/[tenantSlug]`.
- **Assistant/widget flow:** `/widget.js` embed script, tenant-managed widget title/welcome/origin allowlist, WEB_CHAT conversation intake, follow-up state, and ticket handoff.
- **Channel ingest:** protected internal channel envelope endpoint for WhatsApp/provider adapters and channel-neutral conversation processing.
- **Admin operations:** authenticated dashboard, tickets, queues, reports, settings, widget install card, tenant config CRUD, RBAC-aware forms, and audit evidence.
- **Analytics:** operational overview plus channel summaries for tickets, conversations, public messages, AI messages, and automation rate.
- **Release evidence:** API smoke, Playwright smoke, CI jobs, release notes, and run-log checkpoints.

## Workspace

```text
apps/api                NestJS business API
apps/admin-web          Next.js staff/admin/manager panel
apps/citizen-web        Next.js citizen reporting and tracking UI
apps/whatsapp-gateway   WhatsApp/IG/FB/SMS/EMAIL channel adapter boundary
apps/worker             Queue processors for SLA, notifications, reports, retention, media, outbound
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

Smoke and browser checks:

```bash
pnpm smoke:api
pnpm e2e
pnpm e2e:headed
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

Playwright smoke commonly uses isolated QA ports:

```bash
PORT=3110 pnpm --filter @kentos/api dev
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3110/api/v1 pnpm --filter @kentos/admin-web exec next dev --hostname 127.0.0.1 -p 3111
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3110/api/v1 pnpm --filter @kentos/citizen-web exec next dev --hostname 127.0.0.1 -p 3112
E2E_API_BASE_URL=http://127.0.0.1:3110/api/v1 E2E_ADMIN_BASE_URL=http://127.0.0.1:3111 E2E_CITIZEN_BASE_URL=http://127.0.0.1:3112 pnpm exec playwright test --config=playwright.smoke.config.ts --workers=1
```

## Demo seed

Default demo tenant after seed:

- Tenant slug: `demo-belediye`
- Admin email: `admin@demo.local`
- Admin password: `ChangeMe123!`
- Widget preview: `/widget/demo-belediye`
- Widget embed script: `/widget.js`

Use only for local development.

## Environment controls

Required or commonly used local env vars:

```bash
DATABASE_URL=postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_BASE_URL=http://localhost:3100/api/v1
INTERNAL_API_KEY=change-me-internal
WIDGET_ORIGIN_ALLOWLIST=http://localhost:3002,http://127.0.0.1:3002
PUBLIC_RATE_LIMIT_MAX=240
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
```

`WIDGET_ORIGIN_ALLOWLIST` is an operational fallback. Tenant-owned widget origins are stored in the tenant widget settings and can be edited from the admin settings screen.

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

Do not push after every branch merge. Hold pushes until the milestone is complete unless the user explicitly asks for an earlier push.

See [docs/workflows/local-smoke.md](docs/workflows/local-smoke.md) for local API smoke commands, [docs/workflows/browser-smoke.md](docs/workflows/browser-smoke.md) for manual browser-flow verification, and [docs/checklists/release-checklist.md](docs/checklists/release-checklist.md) for merge/release gates.

For multi-surface work with orchestrated parallel execution, see [docs/workflows/parallel-agent-mode.md](docs/workflows/parallel-agent-mode.md).

## Operational governance cadence

- Weekly `stability hour`: smoke kırıkları, CI güvenilirliği, release evidence kalitesi ve açık owner/SLA maddeleri gözden geçirilir.
- Her release döngüsünde evidence snapshot zorunludur: branch sync, static checks, API smoke, browser status, risk, rollback, merge kararı.
- Strict browser `passed` yalnız citizen I/J/K + mobile L explicit kanıtıyla verilir; eksik kanıtta durum `partial` kalır.
- Branch protection teknik enforce mümkün değilse (platform/plan kısıtı), PR review + CI doğrulaması süreçsel olarak zorunlu uygulanır.

Referanslar:
- [docs/checklists/release-checklist.md](docs/checklists/release-checklist.md)
- [docs/workflows/autonomous-run-log.md](docs/workflows/autonomous-run-log.md)
- [docs/releases/RELEASE_NOTES.md](docs/releases/RELEASE_NOTES.md)

## Claude Code Agent OS

This project includes a local Claude Code operating system for autonomous waves, agent roles, workflow commands, hooks policy, MCP policy, parallel-session rules, and other-project installation guidance.

Start here: [docs/agent-os/README.md](docs/agent-os/README.md).
