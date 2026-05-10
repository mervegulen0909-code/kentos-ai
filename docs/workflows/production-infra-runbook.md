# Production Infrastructure Runbook

This repository now includes a self-hosted production scaffold for a single VPS/VM. It prepares the platform, but it does not perform a live deploy automatically.

## Included Services

- PostgreSQL 16
- Redis 7 with append-only persistence and password auth
- MinIO S3-compatible object storage with private bucket bootstrap
- KentOS API
- KentOS worker
- Admin Next.js app
- Citizen Next.js app
- WhatsApp/channel gateway
- Caddy reverse proxy with automatic TLS
- ClamAV daemon (TCP 3310) for attachment virus scanning

## Generate Production Env

Run locally first:

```bash
pnpm infra:prod:bootstrap -- \
  --api-domain api.example.com \
  --admin-domain admin.example.com \
  --citizen-domain citizen.example.com \
  --gateway-domain gateway.example.com \
  --acme-email ops@example.com
```

This writes `.env.production.local`, which is ignored by git. The script generates strong local secrets and does not print them.

Edit the generated file before server use:

- Replace all `example.com` domains with real DNS names.
- Set `WIDGET_ORIGIN_ALLOWLIST` to the real citizen/widget origins.
- Keep `RETENTION_DRY_RUN=true` until a data cleanup window is explicitly approved.
- Keep all `*_OUTBOUND_LIVE=false` until provider credentials and operator approval are recorded.
- Replace `ATTACHMENT_SCAN_PROVIDER=placeholder` with `clamav` once the in-stack ClamAV daemon is healthy. The compose file already starts a ClamAV service on `clamav:3310`; the worker reads `CLAMAV_HOST`/`CLAMAV_PORT` from env and falls back to skipping scans when those are unset.

## Server Bootstrap

On a fresh Ubuntu/Debian VPS:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in, then clone the repo and copy `.env.production.local` into the repo root.

DNS must point these records to the server before Caddy can issue TLS:

- `API_DOMAIN`
- `ADMIN_DOMAIN`
- `CITIZEN_DOMAIN`
- `GATEWAY_DOMAIN`

## First Deploy

```bash
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml build
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml up -d postgres redis minio minio-init
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml run --rm api pnpm db:deploy
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml up -d
```

Optional initial seed is local/demo oriented. Do not seed production tenant data unless you intentionally want demo accounts:

```bash
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml run --rm api pnpm db:seed
```

## Verification

On the server:

```bash
set -a
. ./.env.production.local
set +a
pnpm ops:preflight -- --with-verification
```

Runtime probes:

```bash
curl -fsS "https://$API_DOMAIN/api/v1/health"
curl -fsS "https://$API_DOMAIN/api/v1/health/ready"
```

## Safety Rules

- Production deploy remains a manual operator action.
- Live WhatsApp/email/social outbound remains disabled until explicit approval.
- Real attachment retention delete remains disabled until explicit approval.
- Virus scanning remains a placeholder until a provider is selected.
- Do not run `prisma migrate reset` or delete Docker volumes in production.

## Backups

Minimum daily backup targets:

- PostgreSQL logical dump from `postgres`.
- MinIO volume/object backup.
- `.env.production.local` in a secure password manager, not git.

Example PostgreSQL backup:

```bash
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U kentos kentos_ai > "backup-kentos-ai-$(date +%F).sql"
```
