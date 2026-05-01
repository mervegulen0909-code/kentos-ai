# /kentos-handoff

Use this workflow when switching windows, sessions, or agents.

## Required handoff fields

- Current objective.
- Completed slices.
- Files changed.
- Commands run and results.
- Current blockers.
- Next exact action.
- Files the next session must avoid touching.

## Where to write

- Short durable checkpoint: `docs/workflows/autonomous-run-log.md`.
- Detailed temporary handoff: copy `.claude/templates/handoff.md` into a dated file if needed.

## Rule

A second session must read the handoff before editing anything.
