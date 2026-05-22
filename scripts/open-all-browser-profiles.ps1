param(
  [switch]$OpenWindows
)

$scriptRoot = $PSScriptRoot
$browsers = @('chrome', 'brave', 'edge')
$slots = 1..6

foreach ($browser in $browsers) {
  foreach ($slot in $slots) {
    if ($OpenWindows) {
      & "$scriptRoot\open-browser-profile.ps1" -Browser $browser -Slot $slot
      Start-Sleep -Milliseconds 400
    } else {
      $repoRoot = Split-Path -Parent $scriptRoot
      $profilesRoot = Join-Path $repoRoot '.browser-profiles'
      $profilePrefix = switch ($browser) {
        'chrome' { 'Etsy' }
        'brave' { 'YouTube' }
        'edge' { 'Social' }
      }
      $profileName = '{0}-{1:00}' -f $profilePrefix, $slot
      $profileDir = Join-Path $profilesRoot ("{0}\{1}" -f $browser, $profileName)
      New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
      Write-Host "Hazirlandi: $browser / $profileName"
    }
  }
}

if ($OpenWindows) {
  Write-Host 'Tum browser profilleri acildi.'
} else {
  Write-Host 'Tum browser profil klasorleri hazirlandi.'
}
