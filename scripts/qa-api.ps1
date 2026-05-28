Set-Location (Split-Path -Parent $PSScriptRoot)

$qaHost = if ($env:KENTOS_QA_HOST -and $env:KENTOS_QA_HOST.Trim()) { $env:KENTOS_QA_HOST.Trim() } else { '127.0.0.1' }

$env:DATABASE_URL = 'postgresql://kentos:kentos@localhost:5432/kentos_ai_qa?schema=public'
$env:HOST = '0.0.0.0'
$env:PORT = '3110'
$env:API_URL = "http://${qaHost}:3110"
$env:REDIS_URL = 'redis://127.0.0.1:6379'
$env:JWT_ACCESS_SECRET = 'dev-access-secret-change-me-1234567890'
$env:JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me-1234567890'
$env:CITIZEN_SESSION_SECRET = 'dev-access-secret-change-me-1234567890'
$env:AUTH_LOGIN_THROTTLE_LIMIT = '100'
$env:AUTH_LOGIN_THROTTLE_TTL_MS = '60000'
$env:CITIZEN_ERASURE_THROTTLE_LIMIT = '10'
$env:CITIZEN_ERASURE_THROTTLE_TTL_MS = '60000'
$env:INTERNAL_API_KEY = 'qa-internal-api-key-change-me-32chars'
$env:WIDGET_ORIGIN_ALLOWLIST = "http://${qaHost}:3112,http://localhost:3112,http://127.0.0.1:3112,http://${qaHost}:3111,http://localhost:3111,http://127.0.0.1:3111"
$env:S3_ENDPOINT = 'http://127.0.0.1:9000'
$env:S3_ACCESS_KEY = 'minioadmin'
$env:S3_SECRET_KEY = 'minioadmin'
$env:S3_BUCKET = 'kentos-attachments'
$env:S3_REGION = 'us-east-1'
$env:S3_FORCE_PATH_STYLE = 'true'
$env:S3_PRESIGN_EXPIRES_SECONDS = '900'
$env:S3_DOWNLOAD_EXPIRES_SECONDS = '300'
$env:ATTACHMENT_SCAN_PROVIDER = 'placeholder'
$env:POSTMARK_SERVER_TOKEN = ''  # qa-secrets.local.ps1 dosyasında set et
$env:MAIL_FROM_ADDRESS = 'destek@cebtecep.com'
$env:MAIL_FROM_NAME = 'KentOS'
$env:ADMIN_WEB_URL = 'http://127.0.0.1:3111'

$env:AI_PROVIDER = 'anthropic'
$env:AI_DRAFT_RESPONSE = 'true'
$env:ANTHROPIC_API_KEY = ''  # qa-secrets.local.ps1 dosyasında set et

# Yerel gizli anahtarları yükle (gitignore'da, commit edilmez)
$localSecrets = Join-Path $PSScriptRoot 'qa-secrets.local.ps1'
if (Test-Path $localSecrets) { . $localSecrets }

corepack pnpm --filter @kentos/api start:qa
