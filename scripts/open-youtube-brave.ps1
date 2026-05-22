param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 6)]
  [int]$Slot
)

& "$PSScriptRoot\open-browser-profile.ps1" -Browser brave -Slot $Slot
