# Local Smoke Workflow

Start local infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Run migration and seed:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:migrate
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' pnpm db:seed
```

Start API:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3100 pnpm --filter @kentos/api dev
```

Smoke endpoints:

```bash
curl http://localhost:3100/api/v1/health
curl http://localhost:3100/api/docs
pnpm smoke:api
```

`pnpm smoke:api` verifies health, readiness, demo login, tenant settings write/read, authenticated ticket create/note/public-message/status/audit, and public ticket create/track.

If `3100` is occupied, start API with another port and pass it to the smoke script:

```bash
DATABASE_URL='postgresql://kentos:kentos@localhost:5432/kentos_ai?schema=public' PORT=3110 pnpm --filter @kentos/api dev
KENTOS_API_BASE_URL='http://127.0.0.1:3110/api/v1' pnpm smoke:api
```

Login:

```bash
curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"tenantSlug":"demo-belediye","email":"admin@demo.local","password":"ChangeMe123!"}'
```

Create public ticket:

```bash
curl -s -X POST http://localhost:3100/api/v1/public/demo-belediye/tickets \
  -H 'Content-Type: application/json' \
  -d '{"description":"Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü.","phone":"+905551112233","addressText":"Atatürk Mahallesi 12. Sokak"}'
```

Track public ticket:

```bash
curl http://localhost:3100/api/v1/public/demo-belediye/tickets/KNT-2026-000001
```

Verification:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
```
