# Ops Preflight Runbook

`pnpm ops:preflight` is the safe automation layer for the remaining production gates. It does not deploy, send live channel messages, call paid models, or delete DB/S3 data.

## Default check

```bash
pnpm ops:preflight
```

The default run verifies:

- `master` working tree is clean.
- `master` is synced with `origin/master`.
- live outbound flags are not enabled.
- attachment retention is still dry-run unless explicitly approved.
- production deploy flags are not enabled.
- required production environment variables are present or reported as warnings.
- attachment virus scanning provider is reported as configured or placeholder.

The script writes a local report under `output/ops-preflight/`.

## Full local gate

```bash
pnpm ops:preflight -- --with-verification
```

This also runs:

- `pnpm db:generate` with `PRISMA_GENERATE_NO_ENGINE=true` by default to avoid local Windows Prisma engine lock issues.
- `pnpm --filter @kentos/api test`
- `pnpm --filter @kentos/worker test`
- `pnpm --filter @kentos/shared test`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`

## Approval flags

These flags only unblock the report. They still do not perform the dangerous action.

```bash
pnpm ops:preflight -- --allow-live
pnpm ops:preflight -- --allow-retention-delete
pnpm ops:preflight -- --allow-deploy
```

Use them only after explicit operator approval has been recorded. Real deploy, live outbound, real retention delete, and provider setup remain separate operational actions.
