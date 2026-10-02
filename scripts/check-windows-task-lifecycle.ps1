# Real task lifecycle, restricted to a new named instance with readers disabled.
[CmdletBinding()]
param([switch]$TrayFirst)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$instance='quotapulse-lifecycle-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$data=Join-Path $repo ('tmp\windows-lifecycle\' + $instance)
$output=Join-Path $repo 'screens\windows-task-lifecycle'
New-Item -ItemType Directory -Path $data,$output -Force | Out-Null
Remove-Item -LiteralPath (Join-Path $output 'verification.json') -Force -ErrorAction SilentlyContinue
$sentinel=Join-Path $data 'test-owned-sentinel.txt'
[IO.File]::WriteAllText($sentinel,'retain synthetic instance data')
[IO.File]::WriteAllText((Join-Path $data 'pet-settings.json'),'{"schemaVersion":4,"enabled":false}')
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
$listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
$checks=[Collections.Generic.List[string]]::new()
$ownedPids=[Collections.Generic.List[int]]::new()
$failure=$null
$cleanupFallback=$false
$detachedPid=0
$testStarted=[DateTime]::UtcNow
function Assert($condition,$message) { if (-not $condition) { throw $message } }
function Wait-For($condition,$message) {
  $deadline=[DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) { if (& $condition) { return }; Start-Sleep -Milliseconds 200 }
  throw $message
}
function Original-Definitions {
  $result=@{}
  foreach ($name in @('quotapulse-daemon','quotapulse-tray','plimsoll-daemon','plimsoll-tray','usage-trend-daemon','usage-trend-tray')) {
    $task=Get-ScheduledTask -TaskPath '\' -TaskName $name -ErrorAction SilentlyContinue
    if ($task) {
      $sha=[Security.Cryptography.SHA256]::Create()
      try { $hash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes((Export-ScheduledTask -TaskPath '\' -TaskName $name)))) } finally { $sha.Dispose() }
      $result[$name]=$hash
    }
  }
  return $result
}
function Read-Ready {
  try {
    $lock=Get-Content -LiteralPath (Join-Path $data 'daemon.lock') -Raw | ConvertFrom-Json
    if ($lock.port -ne $port) { return $null }
    $health=Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -Headers @{'x-quotapulse-token'=$lock.token} -TimeoutSec 5
    if ($health.ok -and @($health.scheduler.sources).Count -eq 0) { return $lock }
  } catch { return $null }
}
$before=Original-Definitions
try {
  & (Join-Path $PSScriptRoot 'install-task.ps1') -InstanceName $instance -DataDir $data -Port $port -NoReaders -WhatIf
  foreach ($role in @('daemon','tray')) { Assert (-not (Get-ScheduledTask -TaskPath '\' -TaskName "$instance-$role" -ErrorAction SilentlyContinue)) 'WhatIf registered a real task' }
  $checks.Add('real installer WhatIf creates no task')
  & (Join-Path $PSScriptRoot 'install-task.ps1') -InstanceName $instance -DataDir $data -Port $port -NoReaders
  foreach ($role in @('daemon','tray')) {
    $task=Get-ScheduledTask -TaskPath '\' -TaskName "$instance-$role"
    Assert ($task.Actions.Arguments.Contains('--no-readers') -and $task.Actions.Arguments.Contains("--port $port") -and $task.Actions.Arguments.Contains($data)) 'Registered action lost instance configuration'
    Assert (-not $task.Actions.Execute.EndsWith('powershell.exe')) 'Task must own application process directly'
  }
  $checks.Add('real named task registration preserves selected port/data/readers configuration')
  $firstRole=if($TrayFirst){'tray'}else{'daemon'}
  Start-ScheduledTask -TaskPath '\' -TaskName "$instance-$firstRole"
  Wait-For { $script:readyLock=Read-Ready; $null -ne $script:readyLock } 'Instance daemon did not become ready'
  $first=$script:readyLock; $ownedPids.Add([int]$first.pid)
  if ($TrayFirst) {
    $detachedPid=[int]$first.pid
    Assert ((Get-ScheduledTask -TaskPath '\' -TaskName "$instance-daemon").State -ne 'Running') 'Expected tray-spawned daemon outside daemon task'
    $checks.Add('real tray/main starts its detached daemon with inherited reader opt-out and zero sources')
  } else {
    $checks.Add('real daemon entry starts via Scheduled Task with zero detected sources')
    Start-ScheduledTask -TaskPath '\' -TaskName "$instance-tray"
  }
  Wait-For { Test-Path -LiteralPath (Join-Path $data 'electron') } 'Tray did not create isolated Electron profile'
  Start-Sleep -Seconds 3
  Assert ((Get-ScheduledTask -TaskPath '\' -TaskName "$instance-tray").State -eq 'Running') 'Tray task exited during startup'
  $trayProcess=Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains((Join-Path $PSScriptRoot 'task-entry.cjs')) -and $_.CommandLine.Contains($data) -and $_.CommandLine.Contains('--role tray') }
  Assert (@($trayProcess).Count -eq 1) 'Expected exactly one owned tray process'
  $ownedPids.Add([int]$trayProcess.ProcessId)
  $currentLock=Get-Content -LiteralPath (Join-Path $data 'daemon.lock') -Raw | ConvertFrom-Json
  Assert ($currentLock.pid -eq $first.pid) 'Tray replaced the existing instance daemon'
  $checks.Add('real tray/main stays running with isolated profile and reuses this instance daemon')
  Stop-ScheduledTask -TaskPath '\' -TaskName "$instance-tray"
  Wait-For { (Get-ScheduledTask -TaskPath '\' -TaskName "$instance-tray").State -ne 'Running' } 'Tray task did not stop'
  Wait-For { -not (Get-Process -Id $trayProcess.ProcessId -ErrorAction SilentlyContinue) } 'Stopping tray task left Electron parent alive'
  Wait-For { $null -ne (Read-Ready) } 'Stopping tray also stopped independently managed daemon'
  $checks.Add('stopping tray task terminates its Electron parent and retains independently managed daemon')
  if (-not $TrayFirst) {
    Stop-ScheduledTask -TaskPath '\' -TaskName "$instance-daemon"
    Wait-For { -not (Get-Process -Id $first.pid -ErrorAction SilentlyContinue) } 'Stopping daemon task left its Node child alive'
    $checks.Add('stopping daemon task terminates its owned Node child')
    Start-ScheduledTask -TaskPath '\' -TaskName "$instance-daemon"
    Wait-For { $script:readyLock=Read-Ready; $null -ne $script:readyLock } 'Daemon restart did not recover retained state/lock'
    $second=$script:readyLock; $ownedPids.Add([int]$second.pid)
    Assert ($second.pid -ne $first.pid) 'Daemon did not restart as a new process'
    $checks.Add('task restart recovers retained data and any stale lock')
  }
  & (Join-Path $PSScriptRoot 'uninstall-task.ps1') -InstanceName $instance -StopRunning
  if ($TrayFirst) {
    Wait-For { $null -ne (Read-Ready) } 'Uninstall unexpectedly stopped daemon owned outside task scheduler'
    $checks.Add('task uninstall retains tray-spawned collector owned outside daemon task; test teardown stops it explicitly')
  } else { Wait-For { -not (Get-Process -Id $second.pid -ErrorAction SilentlyContinue) } 'Uninstall left its daemon child alive' }
  foreach ($role in @('daemon','tray')) { Assert (-not (Get-ScheduledTask -TaskPath '\' -TaskName "$instance-$role" -ErrorAction SilentlyContinue)) 'Task definition retained after uninstall' }
  Assert ([IO.File]::ReadAllText($sentinel) -eq 'retain synthetic instance data') 'Synthetic data sentinel changed'
  Assert (Test-Path -LiteralPath (Join-Path $data 'usage.db')) 'Instance database removed'
  $checks.Add('real scoped uninstall removes task definitions and retains instance database/sentinel')
} catch {
  $failure=$_.Exception.Message
  foreach ($role in @('daemon','tray')) {
    $task=Get-ScheduledTask -TaskPath '\' -TaskName "$instance-$role" -ErrorAction SilentlyContinue
    if ($task) {
      $info=Get-ScheduledTaskInfo -TaskPath '\' -TaskName "$instance-$role"
      Write-Host "Test task $role state=$($task.State) lastResult=$($info.LastTaskResult)"
    }
  }
} finally {
  # These unique names were generated here; never stop a default/legacy task.
  try { & (Join-Path $PSScriptRoot 'uninstall-task.ps1') -InstanceName $instance -StopRunning } catch { if (-not $failure) { $failure=$_.Exception.Message } }
  foreach ($ownedPid in $ownedPids) {
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$ownedPid" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and $process.CommandLine.Contains((Join-Path $PSScriptRoot 'task-entry.cjs')) -and $process.CommandLine.Contains($data)) {
      $cleanupFallback=$true
      Stop-Process -Id $ownedPid -Force
    } elseif ($process -and $ownedPid -eq $detachedPid -and $process.CommandLine.Contains((Join-Path $repo 'packages\daemon\dist\index.js')) -and $process.CreationDate.ToUniversalTime() -ge $testStarted) {
      # Expected teardown for the detached collector created only by this test.
      Stop-Process -Id $ownedPid -Force
    }
  }
  $after=Original-Definitions
  if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) { $failure='Original/legacy task definitions changed' }
  else { $checks.Add('original and legacy task definition hashes unchanged') }
  $report=@{status=$(if($failure){'failed'}else{'passed'});scenario=$(if($TrayFirst){'tray-spawned detached collector'}else{'task-managed daemon and tray'});instance=$instance;port=$port;dataDirectory=$data;ownedProcessIds=@($ownedPids.ToArray());checks=@($checks.ToArray());failure=$failure;cleanupFallback=$cleanupFallback;limitations=@('Manual on-demand task start; logon trigger not exercised','Tray renderer/recovery requires separate checks','No live harness readers or provider probes enabled')} | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText((Join-Path $output 'verification.json'),$report,[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $output ($instance + '.json')),$report,[Text.UTF8Encoding]::new($false))
}
if ($failure) { throw $failure }
Write-Host "Windows task lifecycle passed: $($checks.Count) checks; test tasks removed and isolated data retained."
