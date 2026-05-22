# Tum 3 proje grubundaki 18 profili ac
# Chrome (Etsy) + Brave (YouTube) + Edge (Sosyal Medya)

$scriptRoot = $PSScriptRoot

Write-Host "--- Etsy / Chrome (6 profil) ---"
& "$scriptRoot\open-etsy-6.ps1"

Write-Host "--- YouTube / Brave (6 profil) ---"
& "$scriptRoot\open-youtube-6.ps1"

Write-Host "--- Sosyal Medya / Edge (6 profil) ---"
& "$scriptRoot\open-social-6.ps1"

Write-Host "Tum 18 profil acildi."
