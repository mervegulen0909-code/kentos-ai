# YouTube projesi - Brave icindeki 6 profili ac
# Profiller: YouTube-01 ... YouTube-06 (.browser-profiles/brave/)

$scriptRoot = $PSScriptRoot

1..6 | ForEach-Object {
  & "$scriptRoot\open-browser-profile.ps1" -Browser brave -Slot $_
  Start-Sleep -Milliseconds 400
}

Write-Host "YouTube: Brave icindeki 6 profil acildi."
