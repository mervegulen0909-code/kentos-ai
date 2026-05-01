# Git Worktrees for KentOS Agent OS

KentOS AI is initialized as a Git repository with GitHub remote `origin` at `https://github.com/filizgulen1966-tech/kentos-ai.git`. The current integration branch is `master`.

Use worktrees for parallel Claude Code windows only after the branch you want to split from has a clean working tree and a committed baseline.

If a wave branch was already merged into `master` and will be reused for a new wave, align it with current local `master` before editing:

1. Run `git status --short --branch` and `git log --oneline --decorate -5`.
2. If the worktree branch is clean and behind local `master`, run `git merge master` before new edits.
3. If the branch is dirty, conflicted, or the merge is not a fast-forward/clean merge, stop and report the exact state to `1 — Ana Kontrol`.
4. Do not resolve conflicts, discard files, or continue editing from a stale baseline unless `1 — Ana Kontrol` explicitly directs it.

## Preflight

Run this from the main workspace before creating or merging worktrees:

```bash
git status --short
git branch --show-current
git remote -v
```

Expected baseline:

- Current branch: `master`.
- Remote: `origin https://github.com/filizgulen1966-tech/kentos-ai.git`.
- No unexpected uncommitted work in the files another window will own.

Do not create a worktree to bypass local conflicts. Resolve or hand off the existing change first.

## Create parallel worktrees

Example setup for an API, frontend, and QA/docs wave:

```bash
git worktree add ../chatbot-api-wave -b wave/api-hardening master
git worktree add ../chatbot-ui-wave -b wave/ui-polish master
git worktree add ../chatbot-qa-wave -b wave/qa-smoke master
```

Use clear branch names with the owning role and purpose. Keep one Claude Code window per worktree.

## Suggested Claude windows

### Window A — API Architect

Path: `../chatbot-api-wave`

Owns:

- `apps/api/**`
- `packages/database/**`
- `packages/shared/**`
- `scripts/smoke-api.mjs`

Must coordinate with QA before changing smoke coverage.

### Window B — Frontend Operator

Path: `../chatbot-ui-wave`

Owns:

- `apps/admin-web/**`
- `apps/citizen-web/**`

Must run or explicitly defer browser smoke before claiming UI completion.

### Window C — QA Smoke Runner

Path: `../chatbot-qa-wave`

Owns documentation and verification only unless separately authorized:

- `docs/workflows/**`
- `docs/agent-os/**`
- `docs/checklists/**`
- `docs/decisions/**`
- `README.md`

Does not own API/UI implementation files, package code, production env files, or deployment. The QA window may run verification commands and report blockers but should not fix app code from the QA worktree.

## Handoff requirements

Before merging a worktree branch, the owning window should report:

- Branch name and worktree path.
- Files changed.
- Verification commands and results.
- Known blockers or skipped checks.
- Whether browser smoke was run, skipped, or not applicable.
- Any conflict-prone files to watch during merge.

Use `docs/workflows/autonomous-run-log.md` for durable checkpoints when the work spans multiple windows or long unattended runs.

## Merge order

Merge one branch at a time into `master`. Recommended order for wave branches:

1. API/database/contracts branch.
2. Frontend branch that depends on the API shape.
3. QA/docs/smoke branch after the real implementation scope is known.
4. Security/review-only branch, if present, after all implementation branches.

If QA changed only docs, merge it after API/UI so smoke docs reflect the final behavior. If QA found blockers, fix and re-run the relevant smoke before merging QA docs.

## Merge discipline

For each branch:

```bash
git status --short
git merge <branch-name>
```

If conflicts occur:

1. Stop and inspect each conflicted file.
2. Preserve implementation behavior from the owning branch unless the conflict is purely documentation wording.
3. For docs conflicts, prefer the version that matches the final verified behavior, not the newer timestamp.
4. Re-run the smallest relevant check after resolving conflicts.
5. Do not use broad destructive commands such as `git reset --hard`, `git checkout -- .`, or `git clean -fd` unless the user explicitly approves.

After each successful merge:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

If API, database, auth, RBAC, tenant settings, ticket workflow, or public citizen endpoints changed, also run:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

If UI routes, forms, auth/session, settings, ticket pages, or citizen report/track flows changed, run the manual browser smoke checklist in `docs/workflows/browser-smoke.md`.

## Push gate

Do not push from an agent window unless the user explicitly asks for it in that turn. The team default is milestone-end push, not push-after-each-merge.

After a local merge into `master`, it is acceptable for `master` to remain ahead of `origin/master` while the milestone continues. Record verification and merge notes locally, then wait for the main control window to decide when to publish.

Before any push:

- Confirm the branch being pushed.
- Confirm local verification results.
- Confirm no secrets or production env files are staged.
- Confirm whether the push should create/update a PR or only publish the branch.

## Cleanup

After branches are merged, verified, and no uncommitted work remains:

```bash
git worktree remove ../chatbot-api-wave
git worktree remove ../chatbot-ui-wave
git worktree remove ../chatbot-qa-wave
git branch -d wave/api-hardening
git branch -d wave/ui-polish
git branch -d wave/qa-smoke
```

Only remove a worktree after `git status --short` is clean inside that worktree and the branch has been merged or intentionally abandoned with user approval.
