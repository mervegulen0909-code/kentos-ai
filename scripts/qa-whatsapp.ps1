Set-Location (Split-Path -Parent $PSScriptRoot)

$qaHost = if ($env:KENTOS_QA_HOST -and $env:KENTOS_QA_HOST.Trim()) { $env:KENTOS_QA_HOST.Trim() } else { '127.0.0.1' }

# ── WhatsApp / Meta Cloud API ────────────────────────────────────────────────
$env:WHATSAPP_PROVIDER         = 'meta-cloud'
$env:META_APP_SECRET           = ''  # qa-secrets.local.ps1 dosyasında set et
$env:META_WEBHOOK_VERIFY_TOKEN = 'kentos-wa-verify-2026'
$env:META_PHONE_NUMBER_ID      = ''  # qa-secrets.local.ps1 dosyasında set et
$env:META_ACCESS_TOKEN         = ''  # qa-secrets.local.ps1 dosyasında set et
$env:WHATSAPP_DEFAULT_TENANT_ID = ''  # qa-secrets.local.ps1 dosyasında set et
$env:WHATSAPP_OUTBOUND_LIVE    = 'false'
$env:WA_DEFAULT_NOTIFICATION_TEMPLATE = 'kentos_notification'

# ── API & Gateway bağlantısı ─────────────────────────────────────────────────
$env:KENTOS_API_BASE_URL       = "http://${qaHost}:3110"
$env:INTERNAL_API_KEY          = 'qa-internal-api-key-change-me-32chars'
$env:PORT                      = '3120'

# ── Diğer kanallar (DRY-RUN) ─────────────────────────────────────────────────
$env:INSTAGRAM_OUTBOUND_LIVE   = 'false'
$env:FACEBOOK_OUTBOUND_LIVE    = 'false'
$env:SMS_OUTBOUND_LIVE         = 'false'
$env:EMAIL_OUTBOUND_LIVE       = 'false'

# Yerel gizli anahtarları yükle (gitignore'da, commit edilmez)
$localSecrets = Join-Path $PSScriptRoot 'qa-secrets.local.ps1'
if (Test-Path $localSecrets) { . $localSecrets }

corepack pnpm --filter @kentos/whatsapp-gateway dev
