param(
  [ValidateSet('edge', 'brave', 'chrome', 'all')]
  [string]$Browser = 'all'
)

$repoRoot     = Split-Path -Parent $PSScriptRoot
$profilesRoot = Join-Path $repoRoot '.browser-profiles'
$flowUrl      = 'https://labs.google/fx/tr/tools/flow'

$targets = @()

if ($Browser -eq 'edge' -or $Browser -eq 'all') {
  $targets += @{
    Name    = 'Edge'
    Exe     = 'msedge'
    Profile = Join-Path $profilesRoot 'edge\Gemini-05'
  }
}

if ($Browser -eq 'brave' -or $Browser -eq 'all') {
  $targets += @{
    Name    = 'Brave'
    Exe     = "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe"
    Profile = Join-Path $profilesRoot 'brave\Gemini-05'
  }
}

if ($Browser -eq 'chrome' -or $Browser -eq 'all') {
  $targets += @{
    Name    = 'Chrome'
    Exe     = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    Profile = Join-Path $profilesRoot 'chrome\Gemini-05'
  }
}

foreach ($target in $targets) {
  New-Item -ItemType Directory -Force -Path $target.Profile | Out-Null
  Start-Process -FilePath $target.Exe -ArgumentList @(
    "--user-data-dir=$($target.Profile)",
    '--no-first-run',
    '--new-window',
    $flowUrl
  )
  Write-Host "$($target.Name) / Gemini-05 -> Flow acildi"
  Start-Sleep -Milliseconds 500
}
