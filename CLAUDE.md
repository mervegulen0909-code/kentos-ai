# KentOS AI — Claude Code Project Framework

## Mission

KentOS AI is a municipal citizen request, complaint, workflow, SLA, WhatsApp, and admin operations platform. Treat it as a production MVP, not a toy chatbot or landing page.

## Default operating mode

- Work in small verified slices.
- Check `docs/workflows/autonomous-run-log.md` before starting a long task.
- Create or update checkpoints after every coherent feature slice.
- Prefer local-only verification: `pnpm db:generate`, `pnpm typecheck`, `pnpm build`, `pnpm smoke:api`.
- Never claim UI work is complete without either browser/manual smoke or an explicit note that browser smoke was not run.

## Safe autonomy

You may proceed without asking for routine approvals when the work is local, reversible, and inside this workspace:

- editing `apps/**`, `packages/**`, `docs/**`, `scripts/**`, `.claude/**`, root config files,
- running typecheck/build/smoke commands,
- starting local dev servers on alternate localhost ports,
- stopping only workspace-owned dev server processes.

Pause before:

- deleting broad files/data,
- changing real secrets or production env files,
- deploy/publish/push,
- external WhatsApp/email/social sends,
- paid API/model calls,
- large downloads such as browser binaries/models,
- irreversible migrations against non-local DBs,
- killing unrelated processes.

## Project verification standard

Use the smallest relevant check first, then full verification before final report.

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

Local API smoke:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

## Agent OS

This project uses the Agent OS docs in `docs/agent-os/` and templates in `.claude/`:

- agents: `.claude/agents/*.md`
- commands/workflows: `.claude/commands/*.md`
- hooks examples: `.claude/hooks/*.mjs`
- MCP policy: `.claude/mcp/README.md`
- install template for other projects: `.claude/templates/other-project-install.md`

## Parallel work rule

This project is a git repository and uses multiple local worktrees for parallel execution windows. Keep write scopes non-overlapping and log handoffs in `docs/workflows/autonomous-run-log.md`.

When the user explicitly asks for parallel mode, multi-agent mode, or orchestrated agent execution, follow `docs/workflows/parallel-agent-mode.md` and keep worker write scopes non-overlapping.

## Weekly governance cadence

- Run a weekly stability window for smoke reliability, CI health, and release evidence quality.
- Keep owner/SLA fields explicit for every unresolved `partial` or `blocked` release checkpoint.
- Keep `.claude/settings.json` and other local-only files outside release commits.
- If branch protection enforcement is platform-blocked, treat PR review + CI green as mandatory process gates and record this in release notes.

## UI quality bar

Admin UI should feel operational, data-dense, and serious. Citizen UI should be Turkish-first, calm, public-safe, and accessible. Avoid generic SaaS filler copy and avoid exposing raw internal errors to citizens.
