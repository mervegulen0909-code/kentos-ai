param(
  [ValidateSet('install', 'start', 'provision', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $repoRoot '.tools\local-infra'
$downloadsRoot = Join-Path $toolsRoot 'downloads'
$runtimeRoot = Join-Path $toolsRoot 'runtime'
$dataRoot = Join-Path $toolsRoot 'data'
$logsRoot = Join-Path $toolsRoot 'logs'
$pidRoot = Join-Path $toolsRoot 'pids'

$postgresVersion = '16.11-1'
$redisVersion = '8.6.3'
$postgresZip = Join-Path $downloadsRoot "postgresql-$postgresVersion-windows-x64-binaries.zip"
$redisZip = Join-Path $downloadsRoot "Redis-$redisVersion-Windows-x64-cygwin-with-Service.zip"
$minioExe = Join-Path $runtimeRoot 'minio\minio.exe'
$mcExe = Join-Path $runtimeRoot 'minio\mc.exe'
$postgresRoot = Join-Path $runtimeRoot 'pgsql'
$redisRoot = Join-Path $runtimeRoot 'redis'
$redisInstallRoot = Join-Path $redisRoot "Redis-$redisVersion-Windows-x64-cygwin-with-Service"
$postgresData = Join-Path $dataRoot 'postgres'
$redisData = Join-Path $dataRoot 'redis'
$minioData = Join-Path $dataRoot 'minio'

$postgresUrl = "https://get.enterprisedb.com/postgresql/postgresql-$postgresVersion-windows-x64-binaries.zip"
$redisUrl = "https://github.com/redis-windows/redis-windows/releases/download/$redisVersion/Redis-$redisVersion-Windows-x64-cygwin-with-Service.zip"
$minioUrl = 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe'
$mcUrl = 'https://dl.min.io/client/mc/release/windows-amd64/mc.exe'

function Ensure-Directory([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Download-IfMissing([string]$Url, [string]$Path) {
  if (Test-Path $Path) {
    return
  }
  Write-Host "Downloading $Url"
  Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
}

function Invoke-CheckedNative([scriptblock]$Command, [string]$FailureMessage) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
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

function Get-ManagedProcess([string]$Name) {
  $id = Read-Pid $Name
  if (-not $id) {
    return $null
  }
  $process = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($process -and $process.Path -and -not $process.Path.StartsWith($runtimeRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to stop process $id because it is not owned by local-infra."
  }
  return $process
}

function Assert-PortFree([int]$Port) {
  if (Test-PortListening $Port) {
    throw "Port $Port is already accepting connections."
  }
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

function Install-LocalInfra {
  Ensure-Directory $toolsRoot
  Ensure-Directory $downloadsRoot
  Ensure-Directory $runtimeRoot
  Ensure-Directory $dataRoot
  Ensure-Directory $logsRoot
  Ensure-Directory $pidRoot
  Ensure-Directory $redisData
  Ensure-Directory $minioData
  Ensure-Directory (Split-Path -Parent $minioExe)

  Download-IfMissing $postgresUrl $postgresZip
  Download-IfMissing $redisUrl $redisZip
  Download-IfMissing $minioUrl $minioExe
  Download-IfMissing $mcUrl $mcExe

  if (-not (Test-Path (Join-Path $postgresRoot 'share\postgres.bki'))) {
    # EDB archives include pgAdmin; extract only files required by the local server.
    Invoke-CheckedNative { tar.exe -xf $postgresZip -C $runtimeRoot pgsql/bin pgsql/lib pgsql/share } 'PostgreSQL runtime extraction failed.'
  }
  if (-not (Test-Path (Join-Path $redisInstallRoot 'RedisService.exe'))) {
    Ensure-Directory $redisRoot
    Expand-Archive -LiteralPath $redisZip -DestinationPath $redisRoot -Force
  }

  $initdb = Join-Path $postgresRoot 'bin\initdb.exe'
  if (-not (Test-Path (Join-Path $postgresData 'PG_VERSION'))) {
    Ensure-Directory $postgresData
    Invoke-CheckedNative { & $initdb -D $postgresData -U kentos -A trust --encoding=UTF8 --locale=C } 'PostgreSQL data initialization failed.'
  }

  Write-Host 'Local infrastructure binaries and data directories are ready.'
}

function Provision-MinIO {
  $env:MC_CONFIG_DIR = Join-Path $toolsRoot 'mc-config'
  Invoke-CheckedNative { & $mcExe alias set local http://127.0.0.1:9000 minioadmin minioadmin --api S3v4 } 'MinIO alias setup failed.'
  Invoke-CheckedNative { & $mcExe mb --ignore-existing local/kentos-attachments } 'MinIO bucket setup failed.'
}

function Start-LocalInfra {
  Install-LocalInfra
  $postgresIsRunning = Test-PortListening 5432
  $redisIsRunning = Test-PortListening 6379
  $minioIsRunning = Test-PortListening 9000
  $minioConsoleIsRunning = Test-PortListening 9001
  if (-not $postgresIsRunning) {
    Assert-PortFree 5432
  }
  if (-not $redisIsRunning) {
    Assert-PortFree 6379
  }
  if (-not $minioIsRunning) {
    Assert-PortFree 9000
  }
  if (-not $minioConsoleIsRunning) {
    Assert-PortFree 9001
  }

  $pgCtl = Join-Path $postgresRoot 'bin\pg_ctl.exe'
  $createdb = Join-Path $postgresRoot 'bin\createdb.exe'
  $psql = Join-Path $postgresRoot 'bin\psql.exe'
  $redisExe = Join-Path $redisInstallRoot 'redis-server.exe'
  $redisCygwinData = '/cygdrive/' + $redisData.Substring(0, 1).ToLowerInvariant() + $redisData.Substring(2).Replace('\', '/')

  if (-not $postgresIsRunning) {
    Invoke-CheckedNative { & $pgCtl -D $postgresData -l (Join-Path $logsRoot 'postgres.log') -o '-p 5432' -w start } 'PostgreSQL startup failed.'
  }
  $databaseExists = & $psql -h localhost -p 5432 -U kentos -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='kentos_ai'"
  if ($LASTEXITCODE -ne 0) {
    throw 'PostgreSQL connectivity check failed.'
  }
  if (($databaseExists | Out-String).Trim() -ne '1') {
    Invoke-CheckedNative { & $createdb -h localhost -p 5432 -U kentos --maintenance-db=postgres kentos_ai } 'PostgreSQL database creation failed.'
  }

  if (-not $redisIsRunning) {
    $redis = Start-Process -FilePath $redisExe -ArgumentList @('--bind', '127.0.0.1', '--protected-mode', 'yes', '--port', '6379', '--dir', $redisCygwinData) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsRoot 'redis.log') -RedirectStandardError (Join-Path $logsRoot 'redis.err.log') -PassThru
    Write-Pid 'redis' $redis.Id
  }

  if (-not $minioIsRunning -and -not $minioConsoleIsRunning) {
    $env:MINIO_ROOT_USER = 'minioadmin'
    $env:MINIO_ROOT_PASSWORD = 'minioadmin'
    $minio = Start-Process -FilePath $minioExe -ArgumentList @('server', $minioData, '--address', ':9000', '--console-address', ':9001') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logsRoot 'minio.log') -RedirectStandardError (Join-Path $logsRoot 'minio.err.log') -PassThru
    Write-Pid 'minio' $minio.Id
  } elseif ($minioIsRunning -ne $minioConsoleIsRunning) {
    throw 'Only one MinIO port is available; stop the conflicting process before starting local infra.'
  }

  Start-Sleep -Seconds 2
  if (-not (Test-PortListening 6379)) {
    throw 'Redis startup failed; inspect .tools/local-infra/logs/redis*.log.'
  }
  if (-not (Test-PortListening 9000)) {
    throw 'MinIO startup failed; inspect .tools/local-infra/logs/minio*.log.'
  }
  Provision-MinIO
  & $PSCommandPath status
}

function Stop-LocalInfra {
  foreach ($name in @('minio', 'redis')) {
    $process = Get-ManagedProcess $name
    if ($process) {
      Stop-Process -Id $process.Id
    }
    Remove-Item -LiteralPath (Join-Path $pidRoot "$name.pid") -Force -ErrorAction SilentlyContinue
  }

  $pgCtl = Join-Path $postgresRoot 'bin\pg_ctl.exe'
  if (Test-Path $pgCtl) {
    & $pgCtl -D $postgresData stop -m fast 2>$null | Out-Host
  }
}

function Show-LocalInfraStatus {
  $services = @(
    @{ Name = 'postgres'; Port = 5432 },
    @{ Name = 'redis'; Port = 6379 },
    @{ Name = 'minio'; Port = 9000 },
    @{ Name = 'minio-console'; Port = 9001 }
  )
  foreach ($service in $services) {
    $listening = Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue
    $state = if ($listening) {
      "listening pid=$($listening.OwningProcess)"
    } elseif (Test-PortListening $service.Port) {
      'reachable (pid requires elevation)'
    } else {
      'stopped'
    }
    Write-Host "$($service.Name): $state (port $($service.Port))"
  }
}

switch ($Action) {
  'install' { Install-LocalInfra }
  'start' { Start-LocalInfra }
  'provision' { Provision-MinIO }
  'stop' { Stop-LocalInfra }
  'status' { Show-LocalInfraStatus }
}
