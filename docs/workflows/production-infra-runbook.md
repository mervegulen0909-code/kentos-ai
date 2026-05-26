# Production Infrastructure Runbook

This repository now includes a self-hosted production scaffold for a single VPS/VM. It prepares the platform, but it does not perform a live deploy automatically.

If `pnpm` is not yet available on the local machine `PATH`, you can still bootstrap the Node-backed root scripts with `npm run infra:prod:bootstrap -- --help`, `npm run ops:preflight -- --help`, and `npm run ops:external -- --help`. On Windows PowerShell with execution-policy blocks, use `npm.cmd run ...`. Once `corepack enable` (or the team's normal pnpm install flow) has been applied, switch back to the canonical `pnpm ...` commands below.

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
- Keep the generated `CITIZEN_SESSION_SECRET` and `INTERNAL_EVENTS_KEY` secret and distinct; they authorize citizen account actions and live event emission respectively.
- Fill `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` before building the citizen image. These public values are embedded into the Next.js bundle at Docker build time.
- Set `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_BASE64` for API-side ID token verification. Never place the service account value in a `NEXT_PUBLIC_*` variable.
- Configure `SENTRY_DSN`, `BULL_BOARD_USER`, and `BULL_BOARD_PASS` before a final launch-readiness decision.

Before declaring the service available to end users, run the strict gate:

```bash
pnpm ops:external -- --strict-launch --compose
```

The strict gate intentionally blocks launch while ClamAV, citizen Firebase authentication, signed-session/event secrets, or incident-response monitoring values are incomplete.

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

After the services are healthy and Firebase values have been reviewed, rebuild `citizen-web` whenever a `NEXT_PUBLIC_FIREBASE_*` value changes; runtime-only container restarts do not change browser bundle configuration.

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
pnpm verify --skip install,ui
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

Recommended production-readiness order after env review:

1. `pnpm infra:prod:bootstrap -- ...`
2. review `.env.production.local`
3. `pnpm verify --skip install,ui`
4. `pnpm ops:preflight -- --with-verification`
5. `pnpm ops:external -- --env-file .env.production.local --compose --json`
6. `docker compose ... ps`
7. HTTPS health probes
8. read-only browser smoke
9. approved write-path smoke

Operator-owned gates that are intentionally outside repo automation:

- Meta business verification / permanent token / phone registration
- Twilio login + MFA / phone verification
- Postmark business email approval or SMTP credential handoff
- live outbound enable decision
- paid AI provider enable decision
- retention live delete decision

## Current external provider snapshot (2026-05-22)

Observed from operator-assisted browser review:

- Meta Developers:
  - app `KentOS AI` exists and remains `In development`
  - business verification for `FERSA ELEKTRONIK SANAYI VE TICARET LIMITED SIRKETI` is `Değerlendirmede`
  - WhatsApp Business account is attached and approved
  - only the Meta test number `+1 555-647-0488` is currently attached
  - real production phone registration for `+90 535 281 12 35` is still blocked until Meta verification completes
- Twilio:
  - account is still `trial`
  - active Twilio-owned number: `+1 218 663 3732`
  - operator number `+90 535 281 12 35` already exists under `Verified Caller IDs`
  - final `TWILIO_FROM_NUMBER` policy remains operator-owned until the sending-number decision is made
- Postmark:
  - sender signature `destek@cebtecep.com` is confirmed
  - account remains `Test mode`
  - domain `cebtecep.com` still needs DNS verification:
    - DKIM TXT host `20260519190009pm._domainkey`
    - Return-Path CNAME host `pm-bounces`
  - the authoritative DNS control panel for `cebtecep.com` was not found in the accessible Natro account

Treat these as live operator checkpoints. Repo automation should remain on safe defaults until they are resolved.

## Immediate VPS-focused next steps

Use this order after the provider/account blockers above are recorded:

1. keep all live outbound flags false in `.env.production.local`
2. keep `ATTACHMENT_SCAN_PROVIDER=clamav` only if the VPS ClamAV service is healthy; otherwise leave the current safe value and recreate `worker` after the change
3. confirm Bull Board credentials are present:
   - `BULL_BOARD_USER`
   - `BULL_BOARD_PASS`
4. run the canonical server-side gate:

```bash
pnpm verify --skip install,ui
pnpm ops:preflight -- --with-verification
pnpm ops:external -- --env-file .env.production.local --compose --json
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml ps
```

5. verify public health endpoints:

```bash
curl -fsS "https://$API_DOMAIN/api/v1/health"
curl -fsS "https://$API_DOMAIN/api/v1/health/ready"
curl -fsS "https://$GATEWAY_DOMAIN/health"
```

6. only after provider approval and credential readiness, update `.env.production.local`, recreate the affected services, and record a new run-log checkpoint

## SSH rescue fallback

Use this only if normal SSH access to the VPS stops working.

1. In Hetzner Cloud open the server `Rescue` tab and enable rescue mode with power cycle.
2. Prefer attaching a fresh SSH key to rescue mode instead of relying on the temporary password path.
3. Connect to the rescue OS and identify the normal root filesystem:

```bash
lsblk
blkid
mkdir -p /mnt
mount /dev/sda1 /mnt
ls /mnt
```

If `/mnt/etc` and `/mnt/root` do not exist, unmount and try the correct root partition for that host.

4. Restore normal root key access:

```bash
mkdir -p /mnt/root/.ssh
chmod 700 /mnt/root/.ssh
cat ~/.ssh/authorized_keys > /mnt/root/.ssh/authorized_keys
chmod 600 /mnt/root/.ssh/authorized_keys
```

5. Confirm SSH daemon key-auth settings on the mounted normal OS:

```bash
grep -E '^(PermitRootLogin|PubkeyAuthentication)' /mnt/etc/ssh/sshd_config || true
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /mnt/etc/ssh/sshd_config
```

6. Reboot back into the normal OS, disable rescue mode, and verify:

```bash
sync
reboot
```

Then reconnect normally and rerun:

```bash
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml ps
/opt/kentos-ai/infra/healthcheck-prod.sh
```

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
