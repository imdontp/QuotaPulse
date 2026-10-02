[CmdletBinding(SupportsShouldProcess)]
param([ValidateRange(1024,65535)][int]$Port=7807)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$data=Join-Path $root 'review-data'
$entry=Join-Path $PSScriptRoot 'task-entry.cjs'
$manifest=Get-Content -LiteralPath (Join-Path $root 'review-manifest.json') -Raw | ConvertFrom-Json
$node=(Get-Command node -ErrorAction Stop).Source
$abi=& $node -p 'process.versions.modules'
if ($LASTEXITCODE -ne 0 -or $abi -ne $manifest.requiredNodeAbi) { throw "This review bundle requires Node module ABI $($manifest.requiredNodeAbi)." }
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
New-Item -ItemType Directory -Path $data -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $data 'pet-settings.json'),'{"schemaVersion":4,"enabled":false}')
$state=@{port=$Port}
$previousRunAsNode=$env:ELECTRON_RUN_AS_NODE
try {
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
} catch { & (Join-Path $PSScriptRoot 'stop-review.ps1'); throw }
finally { $env:ELECTRON_RUN_AS_NODE=$previousRunAsNode }
Write-Host "Review ready: http://127.0.0.1:$Port/#overview (readers disabled). Use the review tray icon to open the native dashboard."
