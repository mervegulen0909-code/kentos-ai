# Etsy projesi - Chrome icindeki 6 profili ac
# Profiller: Etsy-01 ... Etsy-06 (.browser-profiles/chrome/)

$scriptRoot = $PSScriptRoot

1..6 | ForEach-Object {
  & "$scriptRoot\open-browser-profile.ps1" -Browser chrome -Slot $_
  Start-Sleep -Milliseconds 400
}

Write-Host "Etsy: Chrome icindeki 6 profil acildi."
