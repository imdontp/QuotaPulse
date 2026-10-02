[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$old=Get-Content -LiteralPath (Join-Path $root 'docs\redesign-v1.22\archive-verification.json') -Raw | ConvertFrom-Json
$oldBuild=Get-Content -LiteralPath (Join-Path $root 'docs\redesign-v1.22\bundle-build.json') -Raw | ConvertFrom-Json
$current=Get-Content -LiteralPath (Join-Path $root 'screens\tray-recovery\archive-verification.json') -Raw | ConvertFrom-Json
$target=Join-Path ([IO.Path]::GetTempPath()) ('QuotaPulse-legacy-review-'+[guid]::NewGuid().ToString('N'))
$checks=[Collections.Generic.List[string]]::new()
function Assert($Condition,[string]$Message) { if(-not $Condition) { throw $Message } }
function Marker { Get-Content -LiteralPath (Join-Path $target 'installation.json') -Raw | ConvertFrom-Json }
function Health {
  $lock=Get-Content -LiteralPath (Join-Path $target 'review-data\daemon.lock') -Raw | ConvertFrom-Json
  Invoke-RestMethod -Uri "http://127.0.0.1:$($lock.port)/api/health" -Headers @{'x-quotapulse-token'=$lock.token} -TimeoutSec 3
}
try {
  & (Join-Path $oldBuild.bundle 'scripts\install-review.ps1') -Archive $old.archive -ExpectedSha256 $old.sha256 -Destination $target
  $first=(Marker).active
  Assert (-not (Marker).PSObject.Properties['ownedReleases']) 'Old fixture unexpectedly has receipt field'
  & (Join-Path $target 'start.ps1') -Port 7811
  Assert ((Health).ok -and @((Health).scheduler.sources).Count -eq 0) 'Old isolated review did not start safely'
  & (Join-Path $target 'stop.ps1')
  [IO.File]::WriteAllText((Join-Path $target 'review-data\legacy-sentinel.txt'),'preserved-v1.22-profile')
  $checks.Add('actual shipped v1.22 ZIP and installer start an isolated profile without ownedReleases metadata')
  & (Join-Path $PSScriptRoot 'install-review.ps1') -Archive $current.archive -ExpectedSha256 $current.sha256 -Destination $target
  Assert ((Marker).previous -eq $first -and @((Marker).ownedReleases).Count -eq 2 -and (Marker).ownedReleases -contains $first) 'Legacy release was not registered during upgrade'
  & (Join-Path $target 'start.ps1') -Port 7811
  Assert ((Health).ok -and @((Health).scheduler.sources).Count -eq 0) 'Upgraded retained profile did not start safely'
  & (Join-Path $target 'stop.ps1')
  $checks.Add('v1.23 upgrade registers actual v1.22 release and starts the retained profile with readers off')
  $hash=(Get-FileHash -LiteralPath (Join-Path $target 'review-data\usage.db') -Algorithm SHA256).Hash
  $owned=@((Marker).ownedReleases)
  & (Join-Path $target 'uninstall.ps1')
  foreach($id in $owned) { Assert (-not (Test-Path -LiteralPath (Join-Path (Join-Path $target 'releases') $id))) 'Migrated release was not removed' }
  Assert ((Get-FileHash -LiteralPath (Join-Path $target 'review-data\usage.db') -Algorithm SHA256).Hash -eq $hash) 'Uninstall changed retained legacy DB'
  Assert ([IO.File]::ReadAllText((Join-Path $target 'review-data\legacy-sentinel.txt')) -eq 'preserved-v1.22-profile') 'Legacy profile sentinel lost'
  $checks.Add('uninstall removes both registered real versions and preserves exact stopped DB bytes and profile sentinel')
  $output=Join-Path $root 'screens\review-installation\legacy-upgrade-verification.json'
  [IO.File]::WriteAllText($output,(@{status='passed';target=$target;checks=@($checks);fromArchiveSha256=$old.sha256;toArchiveSha256=$current.sha256;readersDisabled=$true;limitations=@('same compiled app/schema; installer metadata compatibility only','earlier untracked staging/older releases are retained')} | ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
  Write-Host "Legacy review upgrade passed: $($checks.Count) checks."
} finally { if ((Test-Path -LiteralPath (Join-Path $target 'installation.json')) -and (Marker).active) { & (Join-Path $target 'stop.ps1') } }
