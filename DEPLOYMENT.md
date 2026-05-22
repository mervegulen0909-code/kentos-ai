# KentOS AI — Deployment Rehberi

Hetzner VPS (Ubuntu 22.04) üzerinde sıfırdan kurulum ve güncelleme adımları.

---

## Gereksinimler

- Ubuntu 22.04 LTS VPS (min. 4 vCPU / 8 GB RAM önerilen)
- Docker CE + Docker Compose Plugin
- Domain ve DNS: `api.*`, `admin.*`, `vatandas.*`, `gateway.*`, `xn--izmirusul-y9a.com`

```bash
# Docker kurulumu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

## 1. İlk Kurulum

```bash
# Repo klon
git clone https://github.com/<org>/kentos-ai.git /opt/kentos-ai
cd /opt/kentos-ai

# Env dosyası oluştur
cp .env.example .env.production.local
nano .env.production.local   # Aşağıdaki zorunlu değerleri doldur
```

### Zorunlu Env Var'lar

```env
# ── Veritabanı ────────────────────────────────────────────────
POSTGRES_PASSWORD=<en-az-32-karakter-random>

# ── Redis ─────────────────────────────────────────────────────
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=<en-az-32-karakter-random>

# ── JWT ───────────────────────────────────────────────────────
JWT_ACCESS_SECRET=<en-az-32-karakter-random>
JWT_REFRESH_SECRET=<en-az-32-karakter-random>

# ── Depolama (MinIO) ──────────────────────────────────────────
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=<random-kullanici>
S3_SECRET_KEY=<en-az-32-karakter-random>
S3_BUCKET=kentos-uploads

# ── Domain ────────────────────────────────────────────────────
API_DOMAIN=api.xn--izmirusul-y9a.com
ADMIN_DOMAIN=admin.xn--izmirusul-y9a.com
CITIZEN_DOMAIN=vatandas.xn--izmirusul-y9a.com
GATEWAY_DOMAIN=gateway.xn--izmirusul-y9a.com
ACME_EMAIL=admin@example.com
CORS_ORIGIN=https://admin.xn--izmirusul-y9a.com,https://vatandas.xn--izmirusul-y9a.com

# ── CORS & Public URL ──────────────────────────────────────────
PUBLIC_API_BASE_URL=https://api.xn--izmirusul-y9a.com
PUBLIC_CITIZEN_BASE_URL=https://vatandas.xn--izmirusul-y9a.com
PUBLIC_GATEWAY_BASE_URL=https://gateway.xn--izmirusul-y9a.com

# ── Anthropic AI ──────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Hata İzleme ───────────────────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...

# ── Bull Board (queue monitor) ────────────────────────────────
BULL_BOARD_USER=admin
BULL_BOARD_PASS=<guclu-parola>

# ── Vatandaş widget ───────────────────────────────────────────
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=netiva

# ── Kanal outbound (güvenli başlangıç: hepsi kapalı) ──────────
WHATSAPP_OUTBOUND_LIVE=false
EMAIL_OUTBOUND_LIVE=false
SMS_OUTBOUND_LIVE=false
INSTAGRAM_OUTBOUND_LIVE=false
FACEBOOK_OUTBOUND_LIVE=false
```

---

## 2. İlk Başlatma

```bash
cd /opt/kentos-ai/infra

# Veritabanı migrate + seed
docker compose --env-file ../.env.production.local -f docker-compose.prod.yml run --rm api pnpm db:deploy
docker compose --env-file ../.env.production.local -f docker-compose.prod.yml run --rm api pnpm db:seed

# Tüm servisleri başlat
docker compose --env-file ../.env.production.local -f docker-compose.prod.yml up -d

# Logları izle
docker compose --env-file ../.env.production.local -f docker-compose.prod.yml logs -f api worker
```

### Sağlık Kontrolü

```bash
# API ready (Postgres + Redis + ClamAV)
curl https://api.xn--izmirusul-y9a.com/api/v1/health/ready

# Worker health
docker exec kentos-worker curl -s http://localhost:3130/health

# Tüm container'lar ayakta mı?
docker compose --env-file ../.env.production.local -f docker-compose.prod.yml ps
```

---

## 3. Güncelleme (Zero-Downtime)

```bash
cd /opt/kentos-ai
git pull origin master

# Migrate varsa
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml run --rm api pnpm db:deploy

# Rebuild + restart (rolling)
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml up -d --build

# Durum
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml ps
```

---

## 4. Outbound Kanalları Açma

> **Güvenli sıra:** Email → SMS → WhatsApp → Instagram/Facebook

```bash
# Adım 1: Email'i aç ve test et
nano .env.production.local   # EMAIL_OUTBOUND_LIVE=true
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml up -d api worker

# Test: Bir bilet kapat, CSAT maili geldi mi kontrol et
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml logs worker | grep outbound

# Adım 2: WhatsApp (Meta webhook test geçtikten sonra)
# WHATSAPP_OUTBOUND_LIVE=true — aynı şekilde
```

---

## 5. Bull Board (Queue Monitor)

```
URL: https://api.xn--izmirusul-y9a.com/admin/queues
Auth: HTTP Basic — BULL_BOARD_USER / BULL_BOARD_PASS
```

Tüm 8 kuyruk izlenebilir: `sla`, `notifications`, `reports`, `media`, `retention`, `outbound`, `webhooks`, `csat`.

---

## 6. Load Test (k6)

```bash
# k6 kurulumu
brew install k6  # veya: https://k6.io/docs/get-started/installation/

# Smoke test (50 VU × 5dk)
k6 run test/load/k6-smoke.js \
  --env BASE_URL=https://api.xn--izmirusul-y9a.com \
  --env TENANT_SLUG=netiva \
  --env ADMIN_EMAIL=admin@netiva.belediye.tr \
  --env ADMIN_PASS=<parola>

# Hedefler: p95 < 500ms, error rate < %1
```

---

## 7. Yedekleme

```bash
# Manuel anlık yedek
bash /opt/kentos-ai/infra/backup-prod.sh

# Yedekler nerede?
ls -lh /opt/kentos-backups/

# Otomatik: docker-compose backup servisi gece 02:00 UTC çalışır (14 gün retention)
```

---

## 8. Retention Gerçek Silmeyi Aktifleştirme

> Sadece dry-run loglarını onayladıktan sonra!

```bash
# 1. Dry-run loglarını oku
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml logs worker | grep retention

# 2. Manuel yedek al
bash /opt/kentos-ai/infra/backup-prod.sh

# 3. Flags'i aç
nano .env.production.local
# RETENTION_DRY_RUN=false
# RETENTION_DELETE_ATTACHMENT_OBJECTS=true

# 4. Worker'ı yeniden başlat
docker compose --env-file .env.production.local -f infra/docker-compose.prod.yml restart worker
```

---

## 9. Sorun Giderme

```bash
# API logları
docker compose -f infra/docker-compose.prod.yml logs --tail=100 api

# Redis bağlantı testi
docker compose -f infra/docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD ping

# Postgres bağlantı testi
docker compose -f infra/docker-compose.prod.yml exec postgres \
  pg_isready -U kentos -d kentos_ai

# ClamAV testi
docker compose -f infra/docker-compose.prod.yml exec clamav \
  sh -c "echo PING | nc -w5 127.0.0.1 3310"

# Tüm container'ları yeniden başlat
docker compose -f infra/docker-compose.prod.yml restart
```

---

## 10. GitHub Actions CI/CD

`.github/workflows/ci.yml` master'a push geldiğinde otomatik deploy eder.

**Gerekli GitHub Secrets:**
```
PROD_HOST        = 46.224.217.16
PROD_SSH_KEY     = <özel SSH anahtarı (RSA/Ed25519)>
```

SSH anahtarı oluşturma:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/kentos_deploy
cat ~/.ssh/kentos_deploy.pub >> ~/.ssh/authorized_keys  # VPS'te
# cat ~/.ssh/kentos_deploy  → GitHub Secret PROD_SSH_KEY olarak ekle
```
