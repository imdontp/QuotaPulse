[CmdletBinding(SupportsShouldProcess)]
param([ValidateRange(1024,65535)][int]$Port=7807,[string]$InstallationRoot)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'review-profile.ps1')
$data=Get-ReviewDataPath $root $InstallationRoot
$entry=Join-Path $PSScriptRoot 'task-entry.cjs'
$manifest=Get-Content -LiteralPath (Join-Path $root 'review-manifest.json') -Raw | ConvertFrom-Json
$node=(Get-Command node -ErrorAction Stop).Source
$runtimeInfo=& $node -p 'JSON.stringify({abi:process.versions.modules,platform:process.platform,arch:process.arch})'
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect native Node runtime.' }
$runtimeInfo=$runtimeInfo | ConvertFrom-Json
if ($runtimeInfo.abi -ne $manifest.requiredNodeAbi -or $runtimeInfo.platform -ne $manifest.platform -or $runtimeInfo.arch -ne $manifest.arch) { throw "This review bundle requires Node ABI $($manifest.requiredNodeAbi) on $($manifest.platform)/$($manifest.arch)." }
$statePath=Join-Path $data 'review-processes.json'
if (Test-Path -LiteralPath $statePath) {
  $old=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  foreach ($record in @($old.daemon,$old.tray)) {
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.pid)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and $process.CommandLine.Contains($entry) -and $process.CommandLine.Contains($data)) { throw 'Review instance still running; use stop-review before starting again.' }
  }
}
$probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
try { $probe.Start() } finally { $probe.Stop() }
if (-not $PSCmdlet.ShouldProcess($data,'Start isolated review daemon and tray with readers disabled')) { return }
$state=@{port=$Port}
$previousRunAsNode=$env:ELECTRON_RUN_AS_NODE
$instanceLock=$null
$startLock=$null
try {
  if ($InstallationRoot) {
    $lockPath=Join-Path $InstallationRoot 'installation.lock'
    Assert-ReviewPlainPath $lockPath
    $instanceLock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $data=Get-ReviewDataPath $root $InstallationRoot
  }
  New-Item -ItemType Directory -Path $data -Force | Out-Null
  $startLockPath=Join-Path $data 'start.lock'
  Assert-ReviewPlainPath $startLockPath
  $startLock=[IO.File]::Open($startLockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  $running=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') -and $_.CommandLine -and $_.CommandLine.Contains($data) })
  if ($running.Count) { throw 'Review instance still running; use stop-review before starting again.' }
  [IO.File]::WriteAllText((Join-Path $data 'pet-settings.json'),'{"schemaVersion":4,"enabled":false}')
  foreach ($role in @('daemon','tray')) {
    $exe=if($role -eq 'daemon'){$node}else{Join-Path $root 'node_modules\electron\dist\electron.exe'}
    $args='"'+$entry+'" --role '+$role+' --port '+$Port+' --data-dir "'+$data+'" --node-exe "'+$node+'" --no-readers'
    $env:ELECTRON_RUN_AS_NODE=$null
    $child=Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $root -WindowStyle Hidden -PassThru
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($child.Id)"
    $state[$role]=@{pid=$child.Id;created=$process.CreationDate.ToUniversalTime().ToString('O')}
    [IO.File]::WriteAllText($statePath,($state | ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
    if ($role -eq 'daemon') {
      $deadline=[DateTime]::UtcNow.AddSeconds(30); $ready=$false
      while ([DateTime]::UtcNow -lt $deadline) {
        try {
          $lock=Get-Content -LiteralPath (Join-Path $data 'daemon.lock') -Raw | ConvertFrom-Json
          $health=Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -Headers @{'x-quotapulse-token'=$lock.token} -TimeoutSec 2
          if ($lock.pid -eq $child.Id -and $health.ok -and @($health.scheduler.sources).Count -eq 0) {
            Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$Port/api/settings" -Headers @{'x-quotapulse-token'=$lock.token} -ContentType 'application/json' -Body '{"pet_enabled":false,"tray_animation_enabled":false}' -TimeoutSec 2 | Out-Null
            $ready=$true; break
          }
        } catch { }
        Start-Sleep -Milliseconds 200
      }
      if (-not $ready) { throw 'Review daemon did not become ready.' }
    }
  }
} catch {
  if ($state.ContainsKey('daemon') -or $state.ContainsKey('tray')) { & (Join-Path $PSScriptRoot 'stop-review.ps1') -InstallationRoot $InstallationRoot }
  throw
}
finally { $env:ELECTRON_RUN_AS_NODE=$previousRunAsNode; if ($startLock) { $startLock.Dispose() }; if ($instanceLock) { $instanceLock.Dispose() } }
Write-Host "Review ready: http://127.0.0.1:$Port/#overview (readers disabled). Use the review tray icon to open the native dashboard."
