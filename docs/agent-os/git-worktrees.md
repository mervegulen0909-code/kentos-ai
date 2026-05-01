# Git Worktrees for KentOS Agent OS

This project is now initialized as a local git repository. Worktrees can be used for parallel Claude Code sessions after a baseline commit exists.

## Required first step

Create one baseline commit manually after reviewing the initial file list:

```bash
git status --short
git add .gitignore .env.example AGENTS.md CLAUDE.md DESIGN.md README.md .interface-design docs infra package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json apps packages scripts .claude/agents .claude/commands .claude/hooks .claude/mcp .claude/templates .claude/settings.json
git commit -m "Initial KentOS AI workspace baseline"
```

Do not include:

- `.claude/settings.local.json`
- `.env` or `.env.*` except `.env.example`
- `node_modules/`
- `.next/`
- `dist/`

## Create parallel worktrees

After the baseline commit:

```bash
git worktree add ../chatbot-api-wave -b wave/api-hardening
git worktree add ../chatbot-ui-wave -b wave/ui-polish
git worktree add ../chatbot-qa-wave -b wave/qa-smoke
```

## Suggested Claude windows

### Window A — API Architect

Path: `../chatbot-api-wave`

Owns:

- `apps/api/**`
- `packages/database/**`
- `packages/shared/**`
- `scripts/smoke-api.mjs`

### Window B — Frontend Operator

Path: `../chatbot-ui-wave`

Owns:

- `apps/admin-web/**`
- `apps/citizen-web/**`

### Window C — QA Smoke Runner

Path: `../chatbot-qa-wave`

Owns:

- `scripts/**`
- `docs/workflows/**`
- verification only unless asked otherwise

## Merge discipline

1. Each worktree runs scoped verification.
2. Each worktree writes a handoff.
3. Main workspace pulls/merges one branch at a time.
4. After each merge:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

5. If API changed, run local smoke.

## Cleanup

After merging and verifying:

```bash
git worktree remove ../chatbot-api-wave
git worktree remove ../chatbot-ui-wave
git worktree remove ../chatbot-qa-wave
git branch -d wave/api-hardening
git branch -d wave/ui-polish
git branch -d wave/qa-smoke
```

Only remove worktrees after confirming no uncommitted work remains.
