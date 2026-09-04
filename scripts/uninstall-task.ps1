<#
.SYNOPSIS
  Remove the quotapulse logon tasks.

.DESCRIPTION
  Unregisters both scheduled tasks and optionally stops anything still running.
  The collected database in %LOCALAPPDATA%\quotapulse is left alone; delete it
  yourself if you want the history gone.
#>
[CmdletBinding()]
param([switch]$StopRunning)

$ErrorActionPreference = 'Stop'

foreach ($name in @('quotapulse-daemon', 'quotapulse-tray', 'plimsoll-daemon', 'plimsoll-tray', 'usage-trend-daemon', 'usage-trend-tray')) {
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $name -Confirm:$false
    Write-Host "removed task $name"
  } else {
    Write-Host "task $name not present"
  }
}

if ($StopRunning) {
  $lock = Join-Path $env:LOCALAPPDATA 'quotapulse\daemon.lock'
  if (Test-Path $lock) {
    $pidValue = (Get-Content $lock -Raw | ConvertFrom-Json).pid
    try {
      Stop-Process -Id $pidValue -Force
      Write-Host "stopped daemon pid $pidValue"
    } catch {
      Write-Host "daemon pid $pidValue was not running"
    }
    Remove-Item $lock -Force
  }
  Get-Process electron -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like '*quotapulse*' -or $_.MainWindowTitle -like '*QuotaPulse*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host 'History kept at: ' -NoNewline
Write-Host (Join-Path $env:LOCALAPPDATA 'quotapulse\usage.db')
