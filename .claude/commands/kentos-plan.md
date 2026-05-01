# /kentos-plan

Use this workflow when starting a large KentOS task.

## Steps

1. Read `CLAUDE.md`.
2. Read the latest entries in `docs/workflows/autonomous-run-log.md`.
3. Identify the target areas: API, admin-web, citizen-web, worker, docs, smoke.
4. Produce a phase plan with:
   - objective,
   - files likely touched,
   - verification commands,
   - stop conditions,
   - approval gates.
5. Do not edit implementation files until the plan is approved.

## Output

A concise but complete implementation plan that can be executed unattended within safe local boundaries.
