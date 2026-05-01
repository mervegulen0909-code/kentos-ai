# Agent Team Map

## API Architect

Dosyalar:

- `apps/api/**`
- `packages/database/**`
- `packages/shared/**`
- `scripts/smoke-api.mjs`

Ne yapar: API, Prisma, RBAC, tenant isolation, ticket workflow, smoke.

## Frontend Operator

Dosyalar:

- `apps/admin-web/**`
- `apps/citizen-web/**`

Ne yapar: admin/citizen UI, server actions, accessibility, form states.

## QA Smoke Runner

Dosyalar:

- `scripts/**`
- `docs/workflows/**`

Ne yapar: typecheck/build/smoke, browser smoke checklist, blocker raporu.

## Docs Memory Curator

Dosyalar:

- `README.md`
- `CLAUDE.md`
- `docs/**`
- `.claude/templates/**`

Ne yapar: log, handoff, installation docs, workflow memory.

## Security RBAC Reviewer

Dosyalar:

- auth/RBAC/public endpoint/session/hook/script alanları

Ne yapar: read-only güvenlik ve privacy review.

## Parallel çalışma örneği

- Session 1: API Architect — RBAC negative tests.
- Session 2: Frontend Operator — form UX states.
- Session 3: QA Smoke Runner — smoke expansion and docs.

Git yokken bu üç session aynı dosyaları düzenlememeli.
