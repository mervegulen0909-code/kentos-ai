# /kentos-smoke

Use this workflow to verify local runtime behavior.

## API smoke

1. Ensure local infra is up:

```bash
docker compose -f infra/docker-compose.yml up -d
```

2. Start API on an alternate port:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
```

3. Run smoke:

```bash
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

4. Stop only the workspace-owned API process.

## Browser smoke

Follow `docs/workflows/browser-smoke.md`.

## Report

List commands, pass/fail, and any blocker. Do not hide failed smoke results.
