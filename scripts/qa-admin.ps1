Set-Location (Split-Path -Parent $PSScriptRoot)

$qaHost = if ($env:KENTOS_QA_HOST -and $env:KENTOS_QA_HOST.Trim()) { $env:KENTOS_QA_HOST.Trim() } else { '127.0.0.1' }

$env:NEXT_PUBLIC_API_BASE_URL = "http://${qaHost}:3110/api/v1"
$env:NEXT_PUBLIC_PUBLIC_API_BASE_URL = "http://${qaHost}:3110/api/v1"
$env:NEXT_PUBLIC_CITIZEN_WEB_BASE_URL = "http://${qaHost}:3112"
$env:NEXT_DIST_DIR = '.next-qa-admin'

corepack pnpm --filter @kentos/admin-web start:qa
