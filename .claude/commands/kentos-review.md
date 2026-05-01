# /kentos-review

Use this workflow for a local pre-ship review.

## Review checklist

- Tenant isolation on API queries.
- RBAC on write endpoints.
- Citizen public response does not leak internal data.
- Server actions do not expose tokens to client components.
- Smoke script covers new behavior.
- Docs/log updated for the slice.

## Verification

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```

If API changed, also run `pnpm smoke:api` against local API.

## Output

- Findings by severity.
- Files checked.
- Commands run.
- Recommended fixes.
