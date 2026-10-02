<# Install/upgrade an unsigned, isolated review ZIP. Never starts apps or tasks. #>
[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)][string]$Destination,
  [string]$Archive,
  [ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
  [switch]$Rollback
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'review-profile.ps1')
if ($Destination -notmatch '^[a-zA-Z]:[\\/]' -or $Destination -match '["\r\n]') { throw 'Destination must be an absolute local filesystem path.' }
$target=[IO.Path]::GetFullPath($Destination).TrimEnd('\','/')
if ($target -eq [IO.Path]::GetPathRoot($target).TrimEnd('\','/')) { throw 'Destination must not be a filesystem root.' }
Assert-ReviewPlainPath $target
foreach ($legacy in @('quotapulse','plimsoll','usage-trend')) {
  $old=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA $legacy)).TrimEnd('\','/')
  if ($target -eq $old -or $target.StartsWith($old+'\',[StringComparison]::OrdinalIgnoreCase) -or $old.StartsWith($target+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Destination overlaps an existing application data location.' }
}
$marker=Join-Path $target 'installation.json'
Assert-ReviewPlainPath $marker
$releases=Join-Path $target 'releases'
Assert-ReviewPlainPath $releases
$state=$null
if (Test-Path -LiteralPath $marker) {
  $state=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
  if ($state.schemaVersion -ne 1 -or $state.mode -ne 'isolated-review') { throw 'Destination is not an isolated review installation.' }
  foreach ($id in @($state.active,$state.previous)) { if ($id -and $id -notmatch '^release-[a-f0-9]{64}$') { throw 'Invalid installed release identity.' } }
} elseif ((Test-Path -LiteralPath $target) -and @(Get-ChildItem -LiteralPath $target -Force).Count) { throw 'Use a new, empty dedicated destination.' }
$data=Join-Path $target 'review-data'
Assert-ReviewPlainPath $data
# Include independent collectors; do not change the release beneath a running app.
$running=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') -and $_.CommandLine -and $_.CommandLine.Contains($data) })
if ($running.Count) { throw "Stop this review instance before install, upgrade or rollback (PIDs: $($running.ProcessId -join ','))." }
function Enter-InstallationChange {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  $lockPath=Join-Path $target 'installation.lock'
  Assert-ReviewPlainPath $lockPath
  $lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try {
    $current=$null
    if (Test-Path -LiteralPath $marker) {
      $current=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
      if ($current.schemaVersion -ne 1 -or $current.mode -ne 'isolated-review') { throw 'Installation identity changed.' }
      foreach ($id in @($current.active,$current.previous)) { if ($id -and $id -notmatch '^release-[a-f0-9]{64}$') { throw 'Invalid installed release identity.' } }
    }
    $alive=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') -and $_.CommandLine -and $_.CommandLine.Contains($data) })
    if ($alive.Count) { throw 'Stop this review instance before changing releases.' }
    return @{lock=$lock;state=$current}
  } catch { $lock.Dispose(); throw }
}
function Write-Installation($Value) {
  $pending=Join-Path $target ('installation-'+[guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::WriteAllText($pending,($Value | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $marker) { [IO.File]::Replace($pending,$marker,[System.Management.Automation.Language.NullString]::Value) }
  else { [IO.File]::Move($pending,$marker) }
}
function Move-ReviewDirectory([string]$From,[string]$To) {
  $boundary=[IO.Path]::GetFullPath($releases)+'\'
  $From=[IO.Path]::GetFullPath($From); $To=[IO.Path]::GetFullPath($To)
  if (-not $From.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase) -or -not $To.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase) -or $From -eq $To) { throw 'Invalid release move boundary.' }
  Assert-ReviewPlainPath $From; Assert-ReviewPlainPath $To
  $deadline=[DateTime]::UtcNow.AddSeconds(10)
  while ($true) {
    try { [IO.Directory]::Move($From,$To); return }
    catch {
      $code=$_.Exception.GetBaseException().HResult -band 65535
      if ($code -notin @(5,32) -or [DateTime]::UtcNow -ge $deadline -or -not [IO.Directory]::Exists($From) -or [IO.Directory]::Exists($To)) { throw }
      Start-Sleep -Milliseconds 200
    }
  }
}
if ($Rollback) {
  if (-not $state -or -not $state.previous) { throw 'No previous review release is available.' }
  $previous=Join-Path $releases $state.previous
  Assert-ReviewPlainPath $previous
  if (-not (Test-Path -LiteralPath (Join-Path $previous 'review-manifest.json'))) { throw 'Previous release is missing.' }
  if (-not $PSCmdlet.ShouldProcess($target,'Switch active review release to the retained previous release')) { return }
  $change=Enter-InstallationChange
  try {
    $state=$change.state
    if (-not $state.previous) { throw 'No previous review release is available.' }
    $previous=Join-Path $releases $state.previous
    Assert-ReviewPlainPath $previous
    if (-not (Test-Path -LiteralPath (Join-Path $previous 'review-manifest.json'))) { throw 'Previous release is missing.' }
    $active=$state.active; $state.active=$state.previous; $state.previous=$active
    Write-Installation $state
    Write-Host "Review rolled back to $($state.active). Data retained; instance remains stopped."
  } finally { $change.lock.Dispose() }
  return
}
if (-not $Archive -or -not $ExpectedSha256) { throw 'Archive and ExpectedSha256 are required for installation.' }
$Archive=(Resolve-Path -LiteralPath $Archive).Path
$hash=(Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $ExpectedSha256.ToLowerInvariant()) { throw 'Archive checksum mismatch.' }
$release='release-'+$hash
$published=Join-Path $releases $release
if (Test-Path -LiteralPath $published) { throw 'Release already exists; use rollback for a retained release or provide a new ZIP.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$zip=[IO.Compression.ZipFile]::OpenRead($Archive)
try {
  $names=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $zip.Entries) {
    $name=$entry.FullName.Replace('\','/')
    if (-not $name -or $name.StartsWith('/') -or $name.Contains(':') -or ($name.Split('/') -contains '..') -or ($name.Split('/') -contains '.') -or $name -match '[\x00-\x1f]' -or $name -match '^review-data(?:/|$)') { throw "Unsafe or stateful archive entry: $name" }
    if (-not $names.Add($name.TrimEnd('/'))) { throw "Duplicate archive entry: $name" }
    $entryTarget=[IO.Path]::GetFullPath((Join-Path $published $name))
    if (-not $entryTarget.StartsWith($published+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive entry escapes its release directory.' }
  }
  foreach ($required in @('review-manifest.json','scripts/start-review.ps1','scripts/stop-review.ps1','scripts/review-profile.ps1','scripts/install-review.ps1','scripts/task-entry.cjs','packages/daemon/dist/index.js','packages/tray/dist/main.js','node_modules/electron/dist/electron.exe','node_modules/better-sqlite3/build/Release/better_sqlite3.node','packages/web/dist/index.html')) {
    if (-not $zip.GetEntry($required)) { throw "Incomplete review archive: $required" }
  }
  $reader=[IO.StreamReader]::new($zip.GetEntry('review-manifest.json').Open())
  try { $manifest=$reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  if ($manifest.platform -ne 'win32' -or $manifest.arch -ne 'x64' -or $manifest.requiredNodeAbi -ne '127') { throw 'Unsupported review runtime; expected Windows x64 and Node ABI 127.' }
} finally { $zip.Dispose() }
if (-not $PSCmdlet.ShouldProcess($target,"Stage and activate checksum-verified review $($manifest.checkpoint)")) { return }
$change=Enter-InstallationChange
try {
$state=$change.state
New-Item -ItemType Directory -Path $releases -Force | Out-Null
if (Test-Path -LiteralPath $published) { throw 'Release was installed by another operation.' }
if (-not $state) {
  $state=[pscustomobject]@{schemaVersion=1;mode='isolated-review';active=$null;previous=$null}
  # A failed first install retains an inactive, identifiable target for retry.
  Write-Installation $state
}
  foreach ($action in @('start','stop','rollback')) {
    $parameters=if ($action -eq 'start') { '[ValidateRange(1024,65535)][int]$Port=7807' } else { '' }
    $invoke=if ($action -eq 'rollback') { '& (Join-Path $runtime ''scripts/install-review.ps1'') -Rollback -Destination $PSScriptRoot -WhatIf:$WhatIfPreference' }
      elseif ($action -eq 'start') { '& (Join-Path $runtime ''scripts/start-review.ps1'') -InstallationRoot $PSScriptRoot -Port $Port -WhatIf:$WhatIfPreference' }
      else { '& (Join-Path $runtime ''scripts/stop-review.ps1'') -InstallationRoot $PSScriptRoot -WhatIf:$WhatIfPreference' }
    $wrapper=@'
[CmdletBinding(SupportsShouldProcess)]
param(__PARAMETERS__)
$ErrorActionPreference='Stop'
$state=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installation.json') -Raw | ConvertFrom-Json
if ($state.schemaVersion -ne 1 -or $state.mode -ne 'isolated-review' -or $state.active -notmatch '^release-[a-f0-9]{64}$') { throw 'No active isolated review release.' }
$runtime=Join-Path (Join-Path $PSScriptRoot 'releases') $state.active
__INVOKE__
'@
    $wrapperPath=Join-Path $target ($action+'.ps1')
    Assert-ReviewPlainPath $wrapperPath
    if (-not (Test-Path -LiteralPath $wrapperPath)) { [IO.File]::WriteAllText($wrapperPath,$wrapper.Replace('__PARAMETERS__',$parameters).Replace('__INVOKE__',$invoke),[Text.UTF8Encoding]::new($false)) }
  }
$stage=Join-Path $releases ('.stage-'+[guid]::NewGuid().ToString('N'))
Assert-ReviewPlainPath $stage
# Inert staging files remain available for diagnosis on failure. Never delete data.
[IO.Compression.ZipFile]::ExtractToDirectory($Archive,$stage)
Move-ReviewDirectory $stage $published
$next=[pscustomobject]@{schemaVersion=1;mode='isolated-review';active=$release;previous=$state.active}
try { Write-Installation $next }
catch {
  # Return our unpublished release to staging so the same ZIP can be retried.
  # Both paths are fixed children of the verified releases directory, held locked.
  if (-not $published.StartsWith($releases+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $stage.StartsWith($releases+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid recovery move boundary.' }
  Move-ReviewDirectory $published $stage
  throw
}
Write-Host "Review installed: $target; $($manifest.checkpoint). Use start.ps1, stop.ps1 and rollback.ps1. No app or task was started."
} finally { $change.lock.Dispose() }
