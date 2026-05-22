param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('chrome', 'brave', 'edge')]
  [string]$Browser,

  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 6)]
  [int]$Slot
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$profilesRoot = Join-Path $repoRoot '.browser-profiles'

$browserConfig = @{
  chrome = @{
    Name = 'Chrome'
    Url = 'https://www.etsy.com'
    ProfilePrefix = 'Etsy'
    Candidates = @(
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
    )
  }
  brave = @{
    Name = 'Brave'
    Url = 'https://www.youtube.com'
    ProfilePrefix = 'YouTube'
    Candidates = @(
      "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
      "$env:ProgramFiles(x86)\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
  }
  edge = @{
    Name = 'Edge'
    Url = 'https://www.facebook.com'
    ProfilePrefix = 'Social'
    Candidates = @(
      'msedge',
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
      "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
    )
  }
}

$config = $browserConfig[$Browser]
$profileName = '{0}-{1:00}' -f $config.ProfilePrefix, $Slot
$profileDir = Join-Path $profilesRoot ("{0}\{1}" -f $Browser, $profileName)

New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$exePath = $null
foreach ($candidate in $config.Candidates) {
  if ($candidate -eq 'msedge') {
    $exePath = $candidate
    break
  }
  if (Test-Path $candidate) {
    $exePath = $candidate
    break
  }
}

if (-not $exePath) {
  throw "Tarayici bulunamadi: $($config.Name)"
}

$arguments = @(
  "--user-data-dir=$profileDir",
  '--no-first-run',
  '--new-window',
  $config.Url
)

Start-Process -FilePath $exePath -ArgumentList $arguments

Write-Host "$($config.Name) acildi: $profileName"
Write-Host "Profil klasoru: $profileDir"
Write-Host "Ilk acilista ilgili hesaba giris yap. Sonraki acilislarda ayni profil korunur."
