# 0003 — Remove the unused `apps/ai-service` workspace

## Status

Accepted — 2026-05-10

## Context

`apps/ai-service` was added during the early citizen-identity-reconciliation work as a self-contained reference implementation of the public-intake AI runner. It exposed an `IntakeClassifierService` and a `PublicTicketAiRunnerService` and shipped a prompt template at `src/prompts/intake-classifier.v1.ts`.

By the time W3.4 landed (live AI provider wiring with cost cap and AiRun telemetry inside `apps/api/src/modules/public/public-ticket.service.ts`; the runtime is now OpenAI-only), the live runtime path had moved entirely into `apps/api`. The `ai-service` package was no longer imported by any app, worker, or test. Its prompt template was effectively duplicated by the inline prompt builder in `PublicTicketAiService`.

We surveyed the repo with `grep -rn '@kentos/ai-service'` and found references only in:

- `pnpm-workspace.yaml` (package list)
- `pnpm-lock.yaml` (lockfile artifact)
- `.claude/settings.json` (test/typecheck allowlist for the now-orphan package)
- A few historical `docs/workflows/autonomous-run-log.md` checkpoints
- `docs/workflows/local-smoke.md` (a smoke step that runs its tests)
- `README.md` (package map)

No application code, no test, and no smoke runner depended on the package's exported services.

## Decision

Remove `apps/ai-service/**` from the repo. The api keeps the live runner in `public-ticket.service.ts`. The prompt template content is kept inline next to the runner (the exact text already lives there).

`.claude/settings.json` allowlist entries for the package are removed. README and `local-smoke.md` lose their references. Past run-log entries that reference the package are not edited; they remain accurate as historical snapshots.

## Consequences

- Single source of truth for the AI intake runner: `apps/api/src/modules/public/public-ticket.service.ts`.
- One less package to install/typecheck/test on every CI run.
- Operators searching for "AI runner" in the repo now consistently find the api module rather than two divergent files.
- Future prompt iterations live alongside the runner that uses them; removes the risk of the package and the api drifting apart again.
- pnpm-lock.yaml will regenerate cleanly on the next `pnpm install`. The deleted package had no third-party dependencies beyond `@kentos/shared`, so the lockfile drop is mechanical.

## Alternatives considered

- **Re-integrate the package as the runtime path.** Rejected. The existing api implementation already owns budget guard, cost cap, telemetry, and provider switching; pulling it back into a sibling package would force re-injecting Prisma and re-routing the budget/AiRun logic through workspace boundaries that have no other consumer.
- **Keep the package as a "reference" / prompt-engineering harness.** Rejected. Reference code that is never executed quietly rots; the live behavior is now tested directly in the api package via `ai-cost-guard.test.ts` and the smoke suite.
