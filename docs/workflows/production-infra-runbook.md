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
  --municipality-domain www.example.com \
  --api-domain api.example.com \
  --admin-domain admin.example.com \
  --citizen-domain citizen.example.com \
  --gateway-domain gateway.example.com \
  --default-tenant-slug demo-belediye \
  --acme-email ops@example.com
```

This writes `.env.production.local`, which is ignored by git. The script generates strong local secrets and does not print them.

Edit the generated file before server use:

- Replace all `example.com` domains with real DNS names.
- Set `MUNICIPALITY_DOMAIN` to the Natro/demo municipality homepage domain. This route serves a static demo municipality homepage with the KentOS widget embedded.
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

External-system preflight:

```bash
pnpm ops:external -- --env-file .env.production.local --expected-server-ip 203.0.113.10
pnpm ops:external -- --env-file .env.production.local --compose --skip-network
```

The first command checks env completeness, DNS, HTTPS health endpoints, provider readiness, and safety gates. The second command is intended for the VPS and also validates Docker Compose state. Reports are written under `output/ops-external-systems/`.

If production deploy approval has been recorded, the same script can run the deploy sequence on the VPS:

```bash
pnpm ops:external -- --env-file .env.production.local --compose --apply-deploy --i-accept-production-deploy
```

This performs `docker compose build`, starts core services, runs `pnpm db:deploy`, then starts the full stack. It will still block when live outbound or retention delete flags are enabled unless the matching approval flags are supplied.

Provider setup references:

- Anthropic: set `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, and at least one daily budget guard (`AI_DAILY_TOKEN_BUDGET` or `AI_DAILY_COST_BUDGET_MICROS`).
- Email outbound: set `EMAIL_FROM_ADDRESS`; for Postmark set `EMAIL_PROVIDER=postmark` and `POSTMARK_SERVER_TOKEN`; for SMTP set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD`.
- Postmark inbound webhook URL: `https://$GATEWAY_DOMAIN/webhooks/email`; Basic Auth must match `POSTMARK_INBOUND_BASIC_USER` and `POSTMARK_INBOUND_BASIC_PASS`.
- Meta WhatsApp webhook callback URL: `https://$GATEWAY_DOMAIN/webhooks/whatsapp`; verify token must match `META_WEBHOOK_VERIFY_TOKEN`.
- Meta/Twilio live channels: keep live flags false until provider credentials and webhook signatures are validated. The compose file now passes `*_OUTBOUND_LIVE` from `.env.production.local` instead of hardcoding dry-run mode.
- ClamAV: set `ATTACHMENT_SCAN_PROVIDER=clamav` after the `clamav` compose service is healthy, and keep `CLAMAV_HOST=clamav` plus `CLAMAV_PORT=3310` in `.env.production.local` so preflight and worker runtime agree.

## Safety Rules

- Production deploy remains a manual operator action.
- Live WhatsApp/email/social outbound remains disabled until explicit approval.
- Real attachment retention delete remains disabled until explicit approval.
- Virus scanning remains a placeholder until a provider is selected. When ClamAV is selected, verify the daemon is healthy and recreate the worker so it reads the updated env.
- Do not run `prisma migrate reset` or delete Docker volumes in production.

## Backups

Minimum daily backup targets:

- PostgreSQL logical dump from `postgres`.
- MinIO volume/object backup.
- `.env.production.local` in a secure password manager, not git.

The repo includes a VPS-local backup helper that writes timestamped backups under `/opt/kentos-backups` by default:

```bash
chmod +x infra/backup-prod.sh infra/healthcheck-prod.sh
KENTOS_BACKUP_RETENTION_DAYS=14 infra/backup-prod.sh
```

It creates:

- `postgres.sql.gz`
- `minio-prod-data.tar.gz` when the MinIO Docker volume exists
- `SHA256SUMS`

Suggested root cron entries:

```cron
15 2 * * * /opt/kentos-ai/infra/backup-prod.sh >> /var/log/kentos-backup.log 2>&1
*/5 * * * * /opt/kentos-ai/infra/healthcheck-prod.sh >> /var/log/kentos-healthcheck.log 2>&1
```

Restore is intentionally manual: stop the stack, restore the PostgreSQL dump into a fresh database, restore the MinIO archive into the Docker volume, then start services and run the health checks. Never overwrite a live volume/database without taking a fresh backup first.
