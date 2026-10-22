<# Run an ACTUAL previous/current checkout rollback in a new isolated review profile.
No scheduled tasks or live collectors. Requires root's exclusive native execution slot.
PrepareOnly checks real bundle/checkout bindings without starting apps.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$PreviousBundle,
  [Parameter(Mandatory)][string]$PreviousProvenance,
  [Parameter(Mandatory)][string]$CurrentBundle,
  [Parameter(Mandatory)][string]$CurrentProvenance,
  [Parameter(Mandatory)][string]$GitExecutable,
  [ValidateRange(1024,65535)][int]$Port=7818,
  [switch]$PrepareOnly
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'review-profile.ps1')
$helper=Join-Path $PSScriptRoot 'check-release-rollback.cjs'
$node=(Get-Command node -ErrorAction Stop).Source
$base=Join-Path $root 'tmp\release-rollback'
Assert-ReviewPlainPath $base
New-Item -ItemType Directory -Path $base -Force | Out-Null
$fixture=Join-Path $base ('run-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
$tempBase=& $node -e "process.stdout.write(require('node:os').tmpdir())"
$target=Join-Path $tempBase ('qprb-'+(Split-Path -Leaf $fixture).Substring(4,8))
Assert-ReviewPlainPath $target
if(Test-Path -LiteralPath $target){throw 'Refusing to reuse an existing temp installation; rerun with a new fixture'}
$identityPath=Join-Path $fixture 'identities.json'
$report=Join-Path $fixture 'verification.json'
$stages=[Collections.Generic.List[object]]::new()
function Save-Json([string]$Path,$Value) { [IO.File]::WriteAllText($Path,($Value | ConvertTo-Json -Depth 50)+"`n",[Text.UTF8Encoding]::new($false)) }
Save-Json (Join-Path $fixture 'fixture.json') @{mode='synthetic-two-checkout-rollback';fixture=$fixture;installationRoot=$target}
$config=Join-Path $fixture 'inputs.json'
Save-Json $config @{previousBundle=(Resolve-Path -LiteralPath $PreviousBundle).Path;previousProvenance=(Resolve-Path -LiteralPath $PreviousProvenance).Path;currentBundle=(Resolve-Path -LiteralPath $CurrentBundle).Path;currentProvenance=(Resolve-Path -LiteralPath $CurrentProvenance).Path;gitExecutable=(Resolve-Path -LiteralPath $GitExecutable).Path}
function Node-Check([string[]]$Arguments) {
  & $node $helper @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Rollback helper failed: $($Arguments[0])" }
}
function Marker { Get-Content -LiteralPath (Join-Path $target 'installation.json') -Raw | ConvertFrom-Json }
function Active { Join-Path (Join-Path $target 'releases') (Marker).active }
function Stop-Owned {
  if ((Test-Path -LiteralPath (Join-Path $target 'installation.json')) -and (Test-Path -LiteralPath (Join-Path $target 'review-data\review-processes.json'))) {
    & (Join-Path $target 'stop.ps1')
  }
}
function Archive([string]$Bundle,[string]$Name) {
  Assert-ReviewPlainPath $Bundle
  $links=@(Get-ChildItem -LiteralPath $Bundle -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
  if ($links.Count) { throw 'Linked entries are not allowed in rollback archives.' }
  $archive=Join-Path $fixture ($Name+'.zip')
  Add-Type -AssemblyName System.IO.Compression
  $writer=[IO.Compression.ZipFile]::Open($archive,[IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach($file in @(Get-ChildItem -LiteralPath $Bundle -File -Recurse -Force)) {
      $relative=$file.FullName.Substring($Bundle.Length+1).Replace('\','/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($writer,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $writer.Dispose() }
  return @{path=$archive;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$identity=$null;$archives=$null;$baseline=$null;$cleanupError=$null
try {
  Node-Check -Arguments @('inspect',$config,$identityPath)
  $identity=Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
  $longestRelative=[Math]::Max($identity.previous.maxRelativePath,$identity.current.maxRelativePath)
  $longestInstalledPath=$target.Length+'\releases\release-'.Length+64+1+$longestRelative
  if($longestInstalledPath -ge 260){throw 'Temp installation would exceed the tested Windows PowerShell path bound'}
  if ($PrepareOnly) {
    Save-Json $report @{status='prepared only; no app launched';fixture=$fixture;identities=$identity;wholeGoalComplete=$false}
    Write-Host "Two-checkout bindings verified only: $report"
    return
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archives=@{previous=(Archive $identity.previous.bundle 'previous');current=(Archive $identity.current.bundle 'current')}
  & (Join-Path $PSScriptRoot 'install-review.ps1') -Archive $archives.previous.path -ExpectedSha256 $archives.previous.sha256 -Destination $target
  # First start creates only the disposable profile/schema. Stop before direct synthetic seeding.
  & (Join-Path $target 'start.ps1') -Port $Port
  Stop-Owned
  $baseline=Join-Path $fixture 'baseline.json'
  Save-Json (Join-Path $fixture 'previous-seeded-identity.json') $identity.previous
  $seed=Join-Path $fixture 'seed.json'
  Node-Check -Arguments @('seed',$fixture,(Active),$seed)
  # Establish the actual old running mode before freezing the upgrade baseline.
  & (Join-Path $target 'start.ps1') -Port $Port
  Node-Check -Arguments @('live',$fixture,(Join-Path $fixture 'previous-seeded-identity.json'),(Join-Path $fixture 'initialization-live.json'))
  Stop-Owned
  Node-Check -Arguments @('settle',$fixture,(Active),$seed,$baseline,(Join-Path $fixture 'initialization.json'))
  foreach ($stage in @(
    @{name='previous-seeded';identity=$identity.previous},
    @{name='current-upgrade';identity=$identity.current},
    @{name='previous-rollback';identity=$identity.previous},
    @{name='current-recovery';identity=$identity.current}
  )) {
    if ($stage.name -eq 'current-upgrade') {
      & (Join-Path $PSScriptRoot 'install-review.ps1') -Archive $archives.current.path -ExpectedSha256 $archives.current.sha256 -Destination $target
    } elseif ($stage.name -in @('previous-rollback','current-recovery')) {
      & (Join-Path $target 'rollback.ps1')
    }
    $expectedRelease='release-'+$(if($stage.identity.sourceCommit -eq $identity.previous.sourceCommit){$archives.previous.sha256}else{$archives.current.sha256})
    if ((Marker).active -ne $expectedRelease) { throw "Wrong active release during $($stage.name)" }
    $expected=Join-Path $fixture ($stage.name+'-identity.json')
    Save-Json $expected $stage.identity
    $bound=Join-Path $fixture ($stage.name+'-installed.json')
    Node-Check -Arguments @('installed',$fixture,$expected,$bound)
    & (Join-Path $target 'start.ps1') -Port $Port
    $live=Join-Path $fixture ($stage.name+'-live.json')
    Node-Check -Arguments @('live',$fixture,$expected,$live)
    $processState=Get-Content -LiteralPath (Join-Path $target 'review-data\review-processes.json') -Raw | ConvertFrom-Json
    $processes=@()
    foreach ($role in @('daemon','tray')) {
      $record=$processState.$role
      $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$record.pid)" -ErrorAction Stop
      $entry=[IO.Path]::GetFullPath((Join-Path (Active) 'scripts\task-entry.cjs'))
      $data=[IO.Path]::GetFullPath((Join-Path $target 'review-data'))
      $expectedExecutable=if($role -eq 'daemon'){$node}else{Join-Path (Active) 'node_modules\electron\dist\electron.exe'}
      $expectedExecutable=[IO.Path]::GetFullPath($expectedExecutable)
      if (-not $proc -or -not $proc.CommandLine.Contains($entry) -or -not $proc.CommandLine.Contains($data) -or -not $proc.CommandLine.Contains("--role $role") -or -not $proc.CommandLine.Contains('--no-readers') -or $proc.CreationDate.ToUniversalTime().ToString('O') -ne $record.created -or [IO.Path]::GetFullPath($proc.ExecutablePath) -ne $expectedExecutable) { throw "Actual $role process identity does not match this installed checkout" }
      $processes+=@{role=$role;pid=$record.pid;created=$record.created;commandLine=$proc.CommandLine;executablePath=$proc.ExecutablePath;expectedEntry=$entry;expectedData=$data;expectedExecutable=$expectedExecutable}
    }
    Stop-Owned
    foreach ($record in $processes) {
      $remaining=Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$record.pid)" -ErrorAction SilentlyContinue
      if ($remaining -and $remaining.CreationDate.ToUniversalTime().ToString('O') -eq $record.created) { throw 'Owned process has not reached terminal after scoped stop' }
    }
    $afterRuntime=Join-Path $fixture ($stage.name+'-after-stop-installed.json')
    Node-Check -Arguments @('installed',$fixture,$expected,$afterRuntime)
    $after=Join-Path $fixture ($stage.name+'-snapshot.json')
    Node-Check -Arguments @('snapshot',$fixture,(Active),$after)
    if ([IO.File]::ReadAllText($baseline) -ne [IO.File]::ReadAllText($after)) { throw "Durable schema/fact/null/pricing/settings/window invariants changed during $($stage.name); original and observed snapshots retained" }
    $sentinel=Join-Path $target 'review-data\rollback-sentinel.txt'
    if ([IO.File]::ReadAllText($sentinel) -ne "synthetic-only; preserve across actual app checkout rollback`n") { throw 'Synthetic profile sentinel changed' }
    $stages.Add(@{name=$stage.name;sourceCommit=$stage.identity.sourceCommit;release=(Marker).active;installed=$bound;afterStopInstalled=$afterRuntime;live=$live;snapshot=$after;processes=$processes;ownedProcessesTerminal=$true;durableSnapshotEqual=$true})
  }
  Save-Json $report @{status='passed actual two-checkout rollback';fixture=$fixture;identities=$identity;archives=$archives;baseline=$baseline;stages=@($stages);readersDisabled=$true;wholeGoalComplete=$false;limitations=@('unsigned review bundle with host Node prerequisite; no production install or tasks','actual daemon and tray processes boot; no browser UI or dashboard/preload readiness assertion','DB app/notification/window settings covered; Electron localStorage language/theme/currency requires separate native UI persistence check','pet/tray animation disabled by existing review start helper; no pet appearance preference preservation claim','schema7 usage/quota/alert/cursor/rollup/pricing invariants; no cross-schema migration is claimed','the prior reader-disabled mode settles source.enabled before freezing the exact upgrade baseline; no other seeded field may change','no signed artifact, user visual acceptance, CPU budget or whole RC claim')}
  Write-Host "Actual two-checkout rollback passed: $report"
} catch {
  Save-Json $report @{status='failed or incomplete actual two-checkout rollback';fixture=$fixture;error=$_.Exception.ToString();stages=@($stages);wholeGoalComplete=$false}
  throw
} finally {
  try { Stop-Owned } catch { $cleanupError=$_.Exception.ToString(); Write-Warning "Owned review cleanup failed; fixture retained: $cleanupError" }
  if ($cleanupError) {
    $saved=Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
    $saved.status='incomplete; owned cleanup requires inspection'
    $saved | Add-Member -NotePropertyName cleanupError -NotePropertyValue $cleanupError -Force
    Save-Json $report $saved
    throw "Owned cleanup failed: $cleanupError"
  }
}
