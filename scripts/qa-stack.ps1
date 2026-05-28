param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $repoRoot '.qa-logs'
$pidRoot = Join-Path $logRoot 'pids'
$dbUrl = 'postgresql://kentos:kentos@localhost:5432/kentos_ai_qa?schema=public'

function Ensure-Dir([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Resolve-QAHost() {
  $candidate = @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -and
        $_.IPAddress -ne '127.0.0.1' -and
        $_.SkipAsSource -ne $true -and
        $_.InterfaceOperationalStatus -eq 'Up'
      } |
      Sort-Object -Property InterfaceMetric, SkipAsSource |
      Select-Object -First 1 -ExpandProperty IPAddress
  ) | Where-Object { $_ }

  if ($candidate.Count -gt 0) {
    return $candidate[0]
  }

  return '127.0.0.1'
}

function Write-Pid([string]$Name, [int]$Id) {
  Set-Content -LiteralPath (Join-Path $pidRoot "$Name.pid") -Value $Id -Encoding ASCII
}

function Read-Pid([string]$Name) {
  $path = Join-Path $pidRoot "$Name.pid"
  if (-not (Test-Path $path)) {
    return $null
  }
  return [int](Get-Content -LiteralPath $path -Raw).Trim()
}

function Test-PortListening([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connected = $client.ConnectAsync('127.0.0.1', $Port).Wait(500)
    return $connected -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-HttpReady([string]$Url) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-ForHttp([string]$Name, [string]$Url, [int]$Attempts = 30) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    if (Test-HttpReady $Url) {
      Write-Host "$Name ready -> $Url"
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "$Name did not become ready at $Url"
}

function Stop-ManagedProcess([string]$Name) {
  $managedPid = Read-Pid $Name
  if ($managedPid) {
    $process = Get-Process -Id $managedPid -ErrorAction SilentlyContinue
    if ($process) {
      taskkill.exe /PID $managedPid /T /F | Out-Null
    }
    Remove-Item -LiteralPath (Join-Path $pidRoot "$Name.pid") -Force -ErrorAction SilentlyContinue
  }
}

function Stop-ProcessTreeById([int]$Id) {
  if ($Id -le 0) {
    return
  }

  $process = Get-Process -Id $Id -ErrorAction SilentlyContinue
  if ($process) {
    taskkill.exe /PID $Id /T /F | Out-Null
  }
}

function Stop-StaleQAProcesses {
  $processes = Get-CimInstance Win32_Process -Filter "name='node.exe' OR name='powershell.exe' OR name='cmd.exe'" -ErrorAction SilentlyContinue
  foreach ($process in $processes) {
    $commandLine = $process.CommandLine
    if (-not $commandLine) {
      continue
    }

    $repoPattern = [Regex]::Escape($repoRoot)
    $repoOwnedProcess =
      $commandLine -match $repoPattern -or
      $commandLine -match '\.qa-logs' -or
      $commandLine -match 'kentos_ai_qa'

    $looksLikeQAProcess =
      $commandLine -match 'qa-api\.ps1' -or
      $commandLine -match 'qa-admin\.ps1' -or
      $commandLine -match 'qa-citizen\.ps1' -or
      $commandLine -match '@kentos/api start:qa' -or
      $commandLine -match '@kentos/admin-web start:qa' -or
      $commandLine -match '@kentos/citizen-web start:qa' -or
      $commandLine -match '\.next-qa-admin' -or
      $commandLine -match '\.next-qa-citizen' -or
      $commandLine -match 'next\W+start\s+-H\s+0\.0\.0\.0\s+-p\s+3111' -or
      $commandLine -match 'next\W+start\s+-H\s+0\.0\.0\.0\s+-p\s+3112' -or
      $commandLine -match 'dist\\apps\\api\\src\\main\.js' -or
      ($repoOwnedProcess -and (
        $commandLine -match 'prisma' -or
        $commandLine -match 'nest build' -or
        $commandLine -match 'next build' -or
        $commandLine -match 'tsx(\.cmd)?\s+packages\\database\\prisma\\seed\.ts'
      ))

    if ($looksLikeQAProcess) {
      Stop-ProcessTreeById ([int]$process.ProcessId)
    }
  }

  Start-Sleep -Seconds 2
}

function Remove-QABuildArtifacts {
  $targets = @(
    (Join-Path $repoRoot 'apps\api\dist'),
    (Join-Path $repoRoot 'apps\admin-web\.next-qa-admin'),
    (Join-Path $repoRoot 'apps\citizen-web\.next-qa-citizen')
  )

  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
      $removed = $false
      for ($attempt = 0; $attempt -lt 5 -and -not $removed; $attempt++) {
        try {
          Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
          $removed = $true
        } catch {
          if ($attempt -eq 4) {
            throw
          }
          Stop-StaleQAProcesses
          Start-Sleep -Seconds 1
        }
      }
    }
  }
}

function Invoke-QABuildStep([string]$Label, [scriptblock]$Command) {
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Start-ManagedProcess([string]$Name, [string]$ScriptPath) {
  $stdout = Join-Path $logRoot "$Name.out.log"
  $stderr = Join-Path $logRoot "$Name.err.log"
  $process = Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru
  Write-Pid $Name $process.Id
}

function Ensure-LocalInfra {
  if ((Test-PortListening 5432) -and (Test-PortListening 6379) -and (Test-PortListening 9000) -and (Test-PortListening 9001)) {
    Write-Host 'Local infra already listening on 5432/6379/9000/9001; reusing existing processes.'
    return
  }

  npm.cmd run infra:local:start | Out-Host
}

function Reset-QADatabase {
  $createdb = Join-Path $repoRoot '.tools\local-infra\runtime\pgsql\bin\createdb.exe'
  $dropdb = Join-Path $repoRoot '.tools\local-infra\runtime\pgsql\bin\dropdb.exe'
  $psql = Join-Path $repoRoot '.tools\local-infra\runtime\pgsql\bin\psql.exe'

  if (-not (Test-Path $createdb) -or -not (Test-Path $dropdb) -or -not (Test-Path $psql)) {
    throw 'PostgreSQL local-infra binaries are missing; run npm.cmd run infra:local:start first.'
  }

  & $psql -h localhost -p 5432 -U kentos -d postgres -v ON_ERROR_STOP=1 `
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'kentos_ai_qa' AND pid <> pg_backend_pid();" | Out-Null
  & $dropdb -h localhost -p 5432 -U kentos --if-exists kentos_ai_qa 2>$null | Out-Null
  & $createdb -h localhost -p 5432 -U kentos --maintenance-db=postgres kentos_ai_qa | Out-Null
}

function Start-QAStack {
  Ensure-Dir $logRoot
  Ensure-Dir $pidRoot

  $qaHost = Resolve-QAHost
  $publicApiBase = "http://${qaHost}:3110/api/v1"
  $publicCitizenBase = "http://${qaHost}:3112"

  Ensure-LocalInfra
  Stop-ManagedProcess 'qa-citizen'
  Stop-ManagedProcess 'qa-admin'
  Stop-ManagedProcess 'qa-api'
  Stop-StaleQAProcesses
  Remove-QABuildArtifacts

  $env:DATABASE_URL = $dbUrl
  $env:KENTOS_QA_HOST = $qaHost
  $env:NEXT_PUBLIC_API_BASE_URL = $publicApiBase
  $env:NEXT_PUBLIC_PUBLIC_API_BASE_URL = $publicApiBase
  $env:NEXT_PUBLIC_CITIZEN_WEB_BASE_URL = $publicCitizenBase
  $env:NEXT_DIST_DIR = '.next-qa-admin'
  Reset-QADatabase
  Invoke-QABuildStep 'Prisma client generate' { npm.cmd run db:generate | Out-Host }
  Invoke-QABuildStep 'Prisma migrate deploy' { .\packages\database\node_modules\.bin\prisma.CMD migrate deploy --schema packages\database\prisma\schema.prisma | Out-Host }
  Invoke-QABuildStep 'QA seed data' { & .\node_modules\.bin\tsx.CMD packages\database\prisma\seed.ts | Out-Host }
  Invoke-QABuildStep 'API build' { corepack pnpm --filter @kentos/api build | Out-Host }
  Invoke-QABuildStep 'Admin QA build' { corepack pnpm --filter @kentos/admin-web build:qa | Out-Host }
  $env:NEXT_DIST_DIR = '.next-qa-citizen'
  Invoke-QABuildStep 'Citizen QA build' { corepack pnpm --filter @kentos/citizen-web build:qa | Out-Host }

  Start-ManagedProcess 'qa-api' (Join-Path $PSScriptRoot 'qa-api.ps1')
  Wait-ForHttp 'API' "${publicApiBase}/health"

  Start-ManagedProcess 'qa-admin' (Join-Path $PSScriptRoot 'qa-admin.ps1')
  Wait-ForHttp 'Admin' "http://${qaHost}:3111/login"

  Start-ManagedProcess 'qa-citizen' (Join-Path $PSScriptRoot 'qa-citizen.ps1')
  Wait-ForHttp 'Citizen' "${publicCitizenBase}/demo-belediye/report"

  Show-QAStatus
}

function Stop-QAStack {
  Stop-ManagedProcess 'qa-citizen'
  Stop-ManagedProcess 'qa-admin'
  Stop-ManagedProcess 'qa-api'
  Stop-StaleQAProcesses
}

function Show-QAStatus {
  $qaHost = Resolve-QAHost
  $targets = @(
    @{ Name = 'api'; Url = "http://${qaHost}:3110/api/v1/health" },
    @{ Name = 'admin'; Url = "http://${qaHost}:3111/login" },
    @{ Name = 'citizen'; Url = "http://${qaHost}:3112/demo-belediye/report" }
  )

  foreach ($target in $targets) {
    $ready = Test-HttpReady $target.Url
    $managedPid = Read-Pid ("qa-" + $target.Name)
    $state = if ($ready) { 'ready' } else { 'not-ready' }
    Write-Host "$($target.Name): $state pid=$managedPid url=$($target.Url)"
  }
}

switch ($Action) {
  'start' { Start-QAStack }
  'stop' { Stop-QAStack }
  'status' { Show-QAStatus }
}
