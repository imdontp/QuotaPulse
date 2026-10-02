<# Remove registered review releases; retain profile, diagnostics and recovery helpers. #>
[CmdletBinding(SupportsShouldProcess)]
param([string]$Destination=$PSScriptRoot)
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
$releases=Join-Path $target 'releases'
$data=Join-Path $target 'review-data'
foreach ($path in @($marker,$releases,$data)) { Assert-ReviewPlainPath $path }
$original=[IO.File]::ReadAllText($marker)
$state=$original | ConvertFrom-Json
if ($state.schemaVersion -ne 1 -or $state.mode -ne 'isolated-review') { throw 'Destination is not an isolated review installation.' }
$owned=@(@($state.ownedReleases)+@($state.active,$state.previous) | Where-Object { $_ } | Sort-Object -Unique)
foreach ($id in $owned) { if ($id -notmatch '^release-[a-f0-9]{64}$') { throw 'Invalid registered release identity.' } }
function Get-OwnedPath([string]$Id) {
  $path=[IO.Path]::GetFullPath((Join-Path $releases $Id))
  if (-not $path.StartsWith($releases+'\',[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Parent $path) -ne $releases) { throw 'Release deletion escapes its installation boundary.' }
  Assert-ReviewPlainPath $path
  if ((Test-Path -LiteralPath $path) -and -not [IO.Directory]::Exists($path)) { throw 'Registered release is not a directory.' }
  return $path
}
function Assert-UnlinkedTree([string]$Path) {
  if (-not [IO.Directory]::Exists($Path)) { return }
  $pending=[Collections.Generic.Stack[string]]::new(); $pending.Push($Path)
  while ($pending.Count) {
    $directory=$pending.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath ('\\?\'+$directory) -Force) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked entries inside a review release prevent uninstall.' }
      if ($entry.PSIsContainer) {
        $child=$entry.FullName
        if ($child.StartsWith('\\?\')) { $child=$child.Substring(4) }
        if (-not $child.StartsWith($Path+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Release traversal escapes its boundary.' }
        $pending.Push($child)
      }
    }
  }
}
foreach ($id in $owned) { Assert-UnlinkedTree (Get-OwnedPath $id) }
if (-not $PSCmdlet.ShouldProcess($target,'Stop this review instance and remove registered software releases; preserve review-data')) { return }
$lockPath=Join-Path $target 'installation.lock'
Assert-ReviewPlainPath $lockPath
$lease=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
function Write-UninstalledState([object[]]$Remaining) {
  $next=@{schemaVersion=1;mode='isolated-review';status='uninstalled';active=$null;previous=$null;ownedReleases=@($Remaining)}
  $pending=Join-Path $target ('installation-'+[guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::WriteAllText($pending,($next | ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  [IO.File]::Replace($pending,$marker,[System.Management.Automation.Language.NullString]::Value)
}
try {
  if ([IO.File]::ReadAllText($marker) -ne $original) { throw 'Installation changed during uninstall preflight; retry.' }
  foreach ($id in $owned) { Assert-UnlinkedTree (Get-OwnedPath $id) }
  if ($state.active) {
    $active=Get-OwnedPath $state.active
    $stop=Join-Path $active 'scripts\stop-review.ps1'
    Assert-ReviewPlainPath $stop
    & $stop -InstallationRoot $target
  }
  $running=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') -and $_.CommandLine -and $_.CommandLine.Contains($data) })
  if ($running.Count) { throw 'Review processes remain; refusing to remove software.' }
  # Disable start/rollback before deletion; retain receipts for partial-delete retry.
  Write-UninstalledState $owned
  foreach ($id in $owned) {
    $path=Get-OwnedPath $id
    Assert-UnlinkedTree $path
    if ([IO.Directory]::Exists($path)) {
      # This exact absolute child and its tree have been verified inside releases.
      # One PowerShell filesystem provider performs deletion, including long paths.
      Remove-Item -LiteralPath ('\\?\'+$path) -Recurse -Force
    }
  }
  Write-UninstalledState @()
  Write-Host "Review software removed: $target. Profile, diagnostics and recovery helpers retained."
} finally { $lease.Dispose() }
