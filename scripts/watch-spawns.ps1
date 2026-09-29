<#
.SYNOPSIS
  Catch short-lived processes, which is the only way to see a console that flashes and goes.

.DESCRIPTION
  A process that appears and disappears in a few hundred milliseconds cannot be found by
  looking at a process list afterwards -- it is gone before the list is built. That is the
  whole reason a flashing command window is so hard to attribute: the evidence destroys
  itself.

  So this samples continuously and records every process it has not seen before, along with
  the PID that created it. The parent is the decisive datum: if the parent is the QuotaPulse
  daemon or the tray, the spawn is ours and the command line will say which adapter. If the
  parent is explorer, a scheduler, or an updater, it is not.

  It deliberately does not need a command line to work. A process can be gone before its
  command line is readable, and a dead PID is still evidence: name, parent and timing are
  usually enough to identify the source, and the command line is a bonus rather than a
  prerequisite.

.PARAMETER Seconds
  How long to watch. The daemon's scheduled pass interval matters more than this number --
  if nothing is caught in a couple of intervals, the cause is on a longer timer.

.PARAMETER IntervalMs
  Sampling period. 200ms catches most console flashes; anything faster than that is closer
  to invisible than to missed, and lowering it mostly costs WMI throughput.

.EXAMPLE
  powershell -File scripts/watch-spawns.ps1 -Seconds 90
#>
param(
  [int]$Seconds = 60,
  [int]$IntervalMs = 200
)

$ErrorActionPreference = 'SilentlyContinue'

# Process names that are noise on any machine: the things that are always being created and
# are never the answer. Listed so they can be edited rather than guessed at in the output.
$ignore = @(
  'conhost.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe', 'svchost.exe',
  'dwm.exe', 'sihost.exe', 'ctfmon.exe', 'RuntimeBroker.exe', 'SearchHost.exe',
  'ShellExperienceHost.exe', 'StartMenuExperienceHost.exe', 'SystemSettings.exe',
  'TextInputHost.exe', 'LockApp.exe', 'fontdrvhost.exe', 'dllhost.exe', 'wudfhost.exe',
  'BackgroundTaskHost.exe', 'ShellHost.exe', 'smss.exe', 'memcompression.exe'
)

function Get-Snapshot {
  # WMI rather than CIM: in Windows PowerShell 5.1 this is roughly twice as fast for the
  # same class, and the sampling period is the whole budget here.
  $map = @{}
  foreach ($p in Get-WmiObject Win32_Process -Property ProcessId,ParentProcessId,Name,CommandLine) {
    $map[[int]$p.ProcessId] = [pscustomobject]@{
      Name   = $p.Name
      Parent = [int]$p.ParentProcessId
      Cmd    = $p.CommandLine
    }
  }
  return $map
}

Write-Host "Watching for $Seconds s, sampling every $IntervalMs ms..." -ForegroundColor Cyan
$names = @{}
$seen = Get-Snapshot
foreach ($id in $seen.Keys) { $names[[int]$id] = $seen[$id].Name }
Write-Host "Baseline: $($seen.Count) processes already running." -ForegroundColor DarkGray

$captured = New-Object System.Collections.ArrayList
$deadline = (Get-Date).AddSeconds($Seconds)

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds $IntervalMs
  $now = Get-Snapshot

  foreach ($id in $now.Keys) {
    if ($seen.ContainsKey($id)) { continue }
    $child = $now[$id]
    if ($ignore -contains $child.Name) { continue }

    # The parent is frequently created and destroyed faster than we sample, so the name may
    # already be known from a previous sighting or may genuinely be gone. Both are recorded
    # rather than guessed at.
    $parentName = if ($names.ContainsKey($child.Parent)) { $names[$child.Parent] } else { '<exited or unseen>' }
    $names[[int]$id] = $child.Name

    $cmd = $child.Cmd
    if ($cmd -and $cmd.Length -gt 160) { $cmd = $cmd.Substring(0, 160) + '...' }

    [void]$captured.Add([pscustomobject]@{
      At     = (Get-Date).ToString('HH:mm:ss.fff')
      PID    = $id
      Name   = $child.Name
      Parent = "$($child.Parent) ($parentName)"
      Cmd    = $cmd
    })
  }
  $seen = $now
}

Write-Host ""
if ($captured.Count -eq 0) {
  Write-Host "Nothing new appeared in $Seconds s." -ForegroundColor Yellow
  Write-Host "That is a result, not a failure: whatever flashed either runs on a longer timer"
  Write-Host "than this window, or only when a specific action is taken." -ForegroundColor DarkGray
} else {
  Write-Host "$($captured.Count) new process(es), oldest first:" -ForegroundColor Green
  $captured | Format-Table -AutoSize -Wrap
  Write-Host "Read the Parent column first: it is what decides whose these are." -ForegroundColor DarkGray
}
