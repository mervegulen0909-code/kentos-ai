# /kentos-wave

Use this workflow to execute an approved wave.

## Steps

1. Create TodoWrite items for each phase.
2. Add a start checkpoint to `docs/workflows/autonomous-run-log.md`.
3. Implement one coherent slice at a time.
4. Run package-scoped verification after each slice.
5. Add a checkpoint after each passing slice.
6. Run final verification:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

7. If API behavior changed, run local smoke:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

## Stop

Stop only for approval gates, repeated blockers, unsafe state, or when the wave is fully verified.
