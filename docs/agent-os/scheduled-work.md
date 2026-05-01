# Scheduled Work, Loop, and Long-Running Autonomy

Use scheduled or loop-style work only for local, safe, repeatable checks.

## Good uses

- Re-check a long build.
- Re-run smoke after a local API restart.
- Periodically summarize progress in the autonomous log.
- Continue an approved unattended wave while staying inside approval gates.

## Bad uses

- Deploying automatically.
- Sending messages automatically.
- Running paid APIs repeatedly.
- Polling external services aggressively.
- Mutating data without a clear local-only boundary.

## Cadence

- Active build/smoke wait: short interval.
- Idle unattended work: larger interval.
- Stop if the same blocker repeats twice.

## Checkpoint rule

Every loop iteration that changes files must update `docs/workflows/autonomous-run-log.md` before continuing.
