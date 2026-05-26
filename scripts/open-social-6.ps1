# Sosyal Medya projesi - Edge icindeki 6 profili ac
# Profiller: Social-01 ... Social-06 (.browser-profiles/edge/)

$scriptRoot = $PSScriptRoot

1..6 | ForEach-Object {
  & "$scriptRoot\open-browser-profile.ps1" -Browser edge -Slot $_
  Start-Sleep -Milliseconds 400
}

Write-Host "Sosyal Medya: Edge icindeki 6 profil acildi."
