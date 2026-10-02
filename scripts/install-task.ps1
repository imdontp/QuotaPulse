<#
.SYNOPSIS
  Register QuotaPulse logon tasks, optionally as an isolated named instance.
.EXAMPLE
  ./scripts/install-task.ps1 -InstanceName quotapulse-redesign -DataDir C:\QuotaPulse-review-data -Port 7805 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [switch]$NoTray,
  [ValidateRange(1024,65535)][int]$Port = 7676,
  [ValidatePattern('^quotapulse(?:-[a-zA-Z0-9][a-zA-Z0-9-]{0,39})?$')][string]$InstanceName = 'quotapulse',
  [string]$DataDir,
  [switch]$Replace
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if ($InstanceName -ne 'quotapulse' -and (-not $DataDir -or $Port -eq 7676)) { throw 'A named instance requires -DataDir and a port other than 7676.' }
if ($DataDir) {
  if (-not [IO.Path]::IsPathRooted($DataDir) -or [IO.Path]::GetPathRoot($DataDir).Length -lt 3 -or $DataDir -match '["\r\n]') { throw 'DataDir must be an absolute filesystem path.' }
  $DataDir = [IO.Path]::GetFullPath($DataDir).TrimEnd('\','/')
  $shared = @('quotapulse','plimsoll','usage-trend') | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA $_)).TrimEnd('\','/') }
  if ($DataDir -eq [IO.Path]::GetPathRoot($DataDir).TrimEnd('\','/')) { throw 'DataDir must not be a filesystem root.' }
  if ($InstanceName -ne 'quotapulse') {
    foreach ($oldDir in $shared) {
      if ($DataDir -eq $oldDir -or $DataDir.StartsWith($oldDir + '\', [StringComparison]::OrdinalIgnoreCase) -or $oldDir.StartsWith($DataDir + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'A named instance must use a separate data directory.' }
    }
  }
}
$node = (Get-Command node -ErrorAction Stop).Source
$powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$runner = Join-Path $PSScriptRoot 'run-task.ps1'
if (-not (Test-Path -LiteralPath (Join-Path $repo 'packages\daemon\dist\index.js'))) { throw 'Build the daemon before installing tasks.' }
if (-not $NoTray) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo 'packages\tray\dist\main.js'))) { throw 'Build the tray before installing tasks.' }
  Push-Location -LiteralPath $repo
  try { $electron = & $node -p "require('electron')" } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $electron)) { throw 'Electron executable missing.' }
}
$roles = if ($NoTray) { @('daemon') } else { @('daemon','tray') }
$plan = foreach ($role in $roles) {
  $name = "$InstanceName-$role"
  $existing = Get-ScheduledTask -TaskPath '\' -TaskName $name -ErrorAction SilentlyContinue
  if ($existing -and -not $Replace) { throw "Task $name exists; use -Replace to replace its definition." }
  $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $runner + '" -Role ' + $role + ' -Port ' + $Port
  if ($DataDir) { $arguments += ' -DataDir "' + $DataDir + '"' }
  [pscustomobject]@{ Name=$name; Arguments=$arguments; Existing=$existing }
}
if ($InstanceName -eq 'quotapulse') {
  foreach ($old in @('plimsoll-daemon','plimsoll-tray','usage-trend-daemon','usage-trend-tray')) {
    if (Get-ScheduledTask -TaskPath '\' -TaskName $old -ErrorAction SilentlyContinue) { throw "Legacy task $old exists; remove its definition explicitly before installing the default instance." }
  }
}
$touched = [Collections.Generic.List[object]]::new()
try {
  foreach ($item in $plan) {
    if (-not $PSCmdlet.ShouldProcess($item.Name, 'Register QuotaPulse logon task')) { continue }
    $xml = if ($item.Existing) { Export-ScheduledTask -TaskPath '\' -TaskName $item.Name } else { $null }
    $action = New-ScheduledTaskAction -Execute $powershell -Argument $item.Arguments -WorkingDirectory $repo
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $trigger.Delay = 'PT20S'
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    $touched.Add([pscustomobject]@{ Name=$item.Name; Xml=$xml })
    Register-ScheduledTask -TaskPath '\' -TaskName $item.Name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "QuotaPulse $InstanceName" -Force | Out-Null
  }
} catch {
  $failure = $_
  for ($index=$touched.Count-1; $index -ge 0; $index--) {
    $item = $touched[$index]
    try {
      if ($item.Xml) { Register-ScheduledTask -TaskPath '\' -TaskName $item.Name -Xml $item.Xml -Force | Out-Null }
      elseif (Get-ScheduledTask -TaskPath '\' -TaskName $item.Name -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskPath '\' -TaskName $item.Name -Confirm:$false }
    } catch { Write-Warning "Task definition rollback failed for $($item.Name): $_" }
  }
  throw $failure
}
Write-Host "Dashboard: http://127.0.0.1:$Port/"
Write-Host "Task instance: $InstanceName (this script does not start the tasks)."
