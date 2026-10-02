<# Removes task definitions; collected data and manually launched processes are retained. #>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$StopRunning,
  [ValidatePattern('^quotapulse(?:-[a-zA-Z0-9][a-zA-Z0-9-]{0,39})?$')][string]$InstanceName = 'quotapulse'
)
$ErrorActionPreference = 'Stop'
# Stop the tray first so it cannot restart its instance's daemon during removal.
$names = @("$InstanceName-tray", "$InstanceName-daemon")
if ($InstanceName -eq 'quotapulse') { $names += @('plimsoll-tray','plimsoll-daemon','usage-trend-tray','usage-trend-daemon') }
foreach ($name in $names) {
  if (-not (Get-ScheduledTask -TaskPath '\' -TaskName $name -ErrorAction SilentlyContinue)) { continue }
  if (-not $PSCmdlet.ShouldProcess($name, 'Remove QuotaPulse task definition')) { continue }
  if ($StopRunning) { Stop-ScheduledTask -TaskPath '\' -TaskName $name -ErrorAction Stop }
  Unregister-ScheduledTask -TaskPath '\' -TaskName $name -Confirm:$false
}
Write-Host "Task instance: $InstanceName. Data directories and lock files are retained."
