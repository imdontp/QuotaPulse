<#
.SYNOPSIS
  Register quotapulse to start at logon.

.DESCRIPTION
  Creates two scheduled tasks so the two halves stay independent:

    quotapulse-daemon  collects and serves. This is the one that matters -- history
                        keeps accruing whether or not any UI is open.
    quotapulse-tray    the taskbar icon. Optional; skip with -NoTray.

  Both run as the current user, at logon, without elevation. The daemon listens on
  127.0.0.1 only, so no firewall rule is needed or created.

.EXAMPLE
  ./scripts/install-task.ps1
  ./scripts/install-task.ps1 -NoTray
#>
[CmdletBinding()]
param(
  [switch]$NoTray,
  [int]$Port = 7676
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$daemonEntry = Join-Path $repo 'packages\daemon\dist\index.js'
$trayEntry = Join-Path $repo 'packages\tray\dist\main.js'
$electron = Join-Path $repo 'node_modules\electron\dist\electron.exe'

if (-not (Test-Path $daemonEntry)) {
  throw "Daemon is not built. Run 'npm run daemon:build' first (looked for $daemonEntry)."
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node was not found on PATH.' }

function Register-QuotaPulseTask {
  param(
    [string]$Name,
    [string]$Execute,
    [string]$Arguments,
    [string]$Description
  )

  if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
    Write-Host "  replacing existing task $Name"
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
  }

  $action = New-ScheduledTaskAction -Execute $Execute -Argument $Arguments -WorkingDirectory $repo
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  # Give it a moment so the desktop and the harnesses' own files settle first.
  $trigger.Delay = 'PT20S'
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

  Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Description $Description | Out-Null
  Write-Host "  registered $Name"
}

# The project has been called usage-trend and plimsoll; leave no orphaned task behind, or two
# daemons would race for the same database.
foreach ($old in @('plimsoll-daemon', 'plimsoll-tray', 'usage-trend-daemon', 'usage-trend-tray')) {
  if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $old -Confirm:$false
    Write-Host "  removed legacy task $old"
  }
}

Write-Host "quotapulse: installing logon tasks (repo: $repo)"

Register-QuotaPulseTask `
  -Name 'quotapulse-daemon' `
  -Execute $node `
  -Arguments "`"$daemonEntry`"" `
  -Description 'quotapulse collector and local dashboard API (127.0.0.1 only)'

if ($NoTray) {
  Write-Host '  skipping tray task (-NoTray)'
} elseif (Test-Path $electron) {
  Register-QuotaPulseTask `
    -Name 'quotapulse-tray' `
    -Execute $electron `
    -Arguments "`"$trayEntry`"" `
    -Description 'quotapulse taskbar icon'
} else {
  Write-Warning "  electron not found at $electron - skipping tray task. Run 'npm install' then re-run this script."
}

Write-Host ''
Write-Host 'Done. Start them now without logging out:'
Write-Host '  Start-ScheduledTask -TaskName quotapulse-daemon'
if (-not $NoTray) { Write-Host '  Start-ScheduledTask -TaskName quotapulse-tray' }
Write-Host ''
Write-Host "Dashboard: http://127.0.0.1:$Port/"
Write-Host 'Remove with: ./scripts/uninstall-task.ps1'
