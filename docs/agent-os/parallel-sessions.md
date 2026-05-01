# Parallel Sessions and Worktrees

## Current state

This folder is not a git repository. Real `git worktree` workflows are not available yet.

## Safe parallel sessions without git

Use separate Claude Code windows only if each window owns non-overlapping files.

Recommended split:

- Window A: API/backend only.
- Window B: admin-web/citizen-web only.
- Window C: QA/docs/smoke only.

Before editing, each window must read:

- `CLAUDE.md`
- `docs/workflows/autonomous-run-log.md`
- latest handoff file if present.

## Handoff rule

When switching windows, create a concise handoff using `.claude/templates/handoff.md`.

## Permanent multi-window rule

- Window 1 is the main control window. It owns commits, merges, final verification sequencing, and milestone push decisions.
- Windows 2, 3, and 4 edit only within their assigned scopes, run local verification, and report results with uncommitted file lists.
- Worker windows do not commit, merge, push, deploy, or resolve broad cross-branch conflicts unless Window 1 explicitly grants a one-off exception in that turn.
- If a worker branch is dirty or conflicted, the worker stops and reports to Window 1 instead of trying to clean up state.

## Git worktree upgrade path

When the project becomes a git repository:

```bash
git worktree add ../chatbot-api-wave -b wave/api-hardening
git worktree add ../chatbot-ui-wave -b wave/ui-polish
git worktree add ../chatbot-qa-wave -b wave/qa-smoke
```

Each worktree gets one role and one scope. Merge only after typecheck/build/smoke.
