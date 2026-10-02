[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$output=Join-Path $root 'screens\review-installation'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$report=Join-Path $output 'verification.json'
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$archiveReport=Get-Content -LiteralPath (Join-Path $root 'screens\tray-recovery\archive-verification.json') -Raw | ConvertFrom-Json
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('QuotaPulse-install-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
$destination=Join-Path $fixture 'review isolated'
$installer=Join-Path $PSScriptRoot 'install-review.ps1'
$checks=[Collections.Generic.List[string]]::new()
function Assert($Condition,[string]$Message) { if (-not $Condition) { throw $Message } }
function Reject([scriptblock]$Action,[string]$Pattern) {
  $rejected=$false
  try { & $Action } catch { if ($_.Exception.Message -notmatch $Pattern) { throw }; $rejected=$true }
  Assert $rejected "Expected rejection: $Pattern"
}
function Marker { Get-Content -LiteralPath (Join-Path $destination 'installation.json') -Raw | ConvertFrom-Json }
function Active { Join-Path (Join-Path $destination 'releases') (Marker).active }
function Install([string]$Path,[string]$Hash,[switch]$Preview) { & $installer -Archive $Path -ExpectedSha256 $Hash -Destination $destination -WhatIf:$Preview }
function Health {
  $lock=Get-Content -LiteralPath (Join-Path $destination 'review-data\daemon.lock') -Raw | ConvertFrom-Json
  Invoke-RestMethod -Uri "http://127.0.0.1:$($lock.port)/api/health" -Headers @{'x-quotapulse-token'=$lock.token} -TimeoutSec 3
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
function Variant([string]$Name) {
  $path=Join-Path $fixture ($Name+'.zip')
  Copy-Item -LiteralPath $archiveReport.archive -Destination $path
  $zip=[IO.Compression.ZipFile]::Open($path,[IO.Compression.ZipArchiveMode]::Update)
  try {
    $entry=$zip.GetEntry('review-manifest.json'); $reader=[IO.StreamReader]::new($entry.Open())
    try { $manifest=$reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
    $manifest.checkpoint=$Name
    $entry.Delete(); $writer=[IO.StreamWriter]::new($zip.CreateEntry('review-manifest.json').Open())
    try { $writer.Write(($manifest | ConvertTo-Json -Depth 10)) } finally { $writer.Dispose() }
  } finally { $zip.Dispose() }
  return @{path=$path;hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}
}
$dbScript=Join-Path $fixture 'db-sentinel.cjs'
[IO.File]::WriteAllText($dbScript,@'
const {createRequire}=require('node:module');
const req=createRequire(process.argv[2]+'/package.json');
if (!req.resolve('better-sqlite3').startsWith(process.argv[2])) throw Error('dependency fallback');
const db=new (req('better-sqlite3'))(process.argv[3]);
if (process.argv[4]==='seed') db.exec("CREATE TABLE review_install_fixture(value TEXT);INSERT INTO review_install_fixture VALUES('preserved-review-data')");
else if (db.prepare('SELECT value FROM review_install_fixture').get().value!=='preserved-review-data') throw Error('lost review data');
db.close();
'@)
function DbSentinel([string]$Mode) {
  & node $dbScript (Active) (Join-Path $destination 'review-data\usage.db') $Mode
  if ($LASTEXITCODE -ne 0) { throw 'Installed native DB sentinel check failed.' }
}
try {
  Install $archiveReport.archive $archiveReport.sha256 -Preview
  Assert (-not (Test-Path -LiteralPath $destination)) 'Install WhatIf created destination'
  $checks.Add('install WhatIf verifies ZIP without creating the destination')
  Reject { Install $archiveReport.archive ('0'*64) } 'checksum mismatch'
  Assert (-not (Test-Path -LiteralPath $destination)) 'Checksum failure changed destination'
  $checks.Add('incorrect archive checksum fails before destination mutation')
  $unsafe=Join-Path $fixture 'unsafe.zip'; $zip=[IO.Compression.ZipFile]::Open($unsafe,[IO.Compression.ZipArchiveMode]::Create)
  try { $writer=[IO.StreamWriter]::new($zip.CreateEntry('../escape.txt').Open()); $writer.Write('synthetic traversal fixture'); $writer.Dispose() } finally { $zip.Dispose() }
  Reject { Install $unsafe (Get-FileHash -LiteralPath $unsafe -Algorithm SHA256).Hash } 'Unsafe'
  Assert (-not (Test-Path -LiteralPath $destination)) 'Unsafe ZIP changed destination'
  $checks.Add('ZIP traversal is rejected before extraction')
  $existing=Join-Path $fixture 'existing'; New-Item -ItemType Directory -Path $existing | Out-Null
  [IO.File]::WriteAllText((Join-Path $existing 'sentinel.txt'),'original-safe')
  Reject { & $installer -Archive $archiveReport.archive -ExpectedSha256 $archiveReport.sha256 -Destination $existing } 'empty dedicated'
  Assert ([IO.File]::ReadAllText((Join-Path $existing 'sentinel.txt')) -eq 'original-safe') 'Existing folder changed'
  $checks.Add('nonempty unowned destination remains unchanged')
  Install $archiveReport.archive $archiveReport.sha256
  $first=(Marker).active
  Assert (-not (Test-Path -LiteralPath (Join-Path $destination 'review-data'))) 'Install started app/data'
  & (Join-Path $destination 'start.ps1') -WhatIf
  Assert (-not (Test-Path -LiteralPath (Join-Path $destination 'review-data'))) 'Start WhatIf created data'
  $checks.Add('actual ZIP installs inactive processes with immutable release and previewable start wrapper')
  $held=[IO.File]::Open((Join-Path $destination 'installation.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try { Reject { & (Join-Path $destination 'start.ps1') -Port 7810 } 'used by another process|being used|cannot access|sharing violation' } finally { $held.Dispose() }
  Assert (-not (Test-Path -LiteralPath (Join-Path $destination 'review-data'))) 'Locked start created app profile'
  $checks.Add('installation lock prevents start without creating app data or invoking process cleanup')
  & (Join-Path $destination 'start.ps1') -Port 7810
  Assert ((Health).ok -and @((Health).scheduler.sources).Count -eq 0) 'Installed daemon/readers mismatch'
  Reject { & (Join-Path $destination 'start.ps1') -Port 7810 } 'still running'
  Assert ((Health).ok) 'Duplicate start stopped the running review daemon'
  Reject { & $installer -Rollback -Destination $destination } 'Stop this review'
  Reject { Install $archiveReport.archive $archiveReport.sha256 } 'Stop this review'
  & (Join-Path $destination 'stop.ps1')
  DbSentinel 'seed'
  $checks.Add('installed real daemon/tray starts with readers off; running upgrades/rollback rejected; scoped stop succeeds')
  $second=Variant 'synthetic-upgrade-same-runtime'
  $before=[IO.File]::ReadAllText((Join-Path $destination 'installation.json'))
  $held=[IO.File]::Open((Join-Path $destination 'installation.lock'),[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try { Reject { Install $second.path $second.hash } 'used by another process|being used|cannot access|sharing violation' } finally { $held.Dispose() }
  Assert ([IO.File]::ReadAllText((Join-Path $destination 'installation.json')) -eq $before) 'Locked upgrade changed pointer'
  $checks.Add('exclusive installation lock rejects competing upgrade and retains active pointer')
  Install $second.path $second.hash
  Assert ((Marker).previous -eq $first -and (Marker).active -ne $first) 'Upgrade did not retain previous release'
  & (Join-Path $destination 'start.ps1') -Port 7810
  Assert ((Health).ok) 'Upgraded daemon did not start'
  & (Join-Path $destination 'stop.ps1')
  DbSentinel 'check'
  $checks.Add('upgrade retains prior runtime and the same database sentinel; upgraded real daemon/tray starts')
  $before=[IO.File]::ReadAllText((Join-Path $destination 'installation.json'))
  & (Join-Path $destination 'rollback.ps1') -WhatIf
  Assert ([IO.File]::ReadAllText((Join-Path $destination 'installation.json')) -eq $before) 'Rollback WhatIf changed pointer'
  & (Join-Path $destination 'rollback.ps1')
  Assert ((Marker).active -eq $first) 'Rollback did not restore first release'
  & (Join-Path $destination 'start.ps1') -Port 7810
  Assert ((Health).ok) 'Rolled-back daemon did not start'
  & (Join-Path $destination 'stop.ps1')
  DbSentinel 'check'
  $checks.Add('rollback WhatIf is inert; actual rollback starts retained runtime and preserves database sentinel')
  $third=Variant 'synthetic-activation-failure-same-runtime'
  $before=[IO.File]::ReadAllText((Join-Path $destination 'installation.json'))
  $databaseHash=(Get-FileHash -LiteralPath (Join-Path $destination 'review-data\usage.db') -Algorithm SHA256).Hash
  $held=[IO.File]::Open((Join-Path $destination 'installation.json'),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try { Reject { Install $third.path $third.hash } 'used by another process|being used|cannot access|sharing violation' } finally { $held.Dispose() }
  Assert ([IO.File]::ReadAllText((Join-Path $destination 'installation.json')) -eq $before) 'Failed activation changed pointer'
  Assert ((Get-FileHash -LiteralPath (Join-Path $destination 'review-data\usage.db') -Algorithm SHA256).Hash -eq $databaseHash) 'Failed activation changed data'
  Install $third.path $third.hash
  & (Join-Path $destination 'start.ps1') -Port 7810
  Assert ((Health).ok) 'Retry release did not start'
  & (Join-Path $destination 'stop.ps1')
  DbSentinel 'check'
  $checks.Add('real atomic pointer failure preserves active release/data; staged payload can be retried and starts successfully')
  $uninstall=Join-Path $destination 'uninstall.ps1'
  $saved=[IO.File]::ReadAllText((Join-Path $destination 'installation.json'))
  $bad=Marker; $bad.ownedReleases=@('..\protected')
  [IO.File]::WriteAllText((Join-Path $destination 'installation.json'),($bad | ConvertTo-Json -Depth 5))
  try { Reject { & $uninstall } 'Invalid registered' } finally { [IO.File]::WriteAllText((Join-Path $destination 'installation.json'),$saved) }
  $checks.Add('uninstall rejects malformed ownership receipts before touching processes or data')
  $protected=Join-Path $fixture 'protected'; New-Item -ItemType Directory -Path $protected | Out-Null
  [IO.File]::WriteAllText((Join-Path $protected 'sentinel.txt'),'protected-outside-release')
  $link=Join-Path (Active) 'test-junction'
  New-Item -ItemType Junction -Path $link -Target $protected | Out-Null
  try { Reject { & $uninstall } 'Linked entries' } finally {
    $absolute=[IO.Path]::GetFullPath($link)
    Assert ($absolute.StartsWith([IO.Path]::GetFullPath($fixture)+'\') -and ((Get-Item -LiteralPath $absolute -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) 'Invalid test junction removal boundary'
    [IO.Directory]::Delete($absolute)
  }
  Assert ([IO.File]::ReadAllText((Join-Path $protected 'sentinel.txt')) -eq 'protected-outside-release') 'Junction target changed'
  $checks.Add('nested junction prevents uninstall; target sentinel is preserved')
  & (Join-Path $destination 'start.ps1') -Port 7810
  $before=[IO.File]::ReadAllText((Join-Path $destination 'installation.json'))
  & $uninstall -WhatIf
  Assert ([IO.File]::ReadAllText((Join-Path $destination 'installation.json')) -eq $before -and (Health).ok) 'Uninstall WhatIf changed running instance'
  $checks.Add('uninstall WhatIf retains active pointer, software and running daemon/tray')
  $registered=@((Marker).ownedReleases)
  Assert ($registered.Count -eq 3) 'Successful older releases were not registered for removal'
  $unknown=Join-Path $destination 'releases\unowned-diagnostic'; New-Item -ItemType Directory -Path $unknown | Out-Null
  [IO.File]::WriteAllText((Join-Path $unknown 'sentinel.txt'),'retained-unowned-diagnostic')
  $heldFile=Join-Path (Join-Path (Join-Path $destination 'releases') $registered[0]) 'README-REVIEW.txt'
  $held=[IO.File]::Open($heldFile,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try { Reject { & $uninstall } 'used by another process|being used|cannot access|sharing violation' } finally { $held.Dispose() }
  Assert (-not (Marker).active -and (Marker).ownedReleases.Count -eq 3) 'Partial uninstall lost receipts or kept active runtime'
  Reject { & (Join-Path $destination 'start.ps1') } 'No active'
  Assert (Test-Path -LiteralPath (Join-Path $destination 'review-data\usage.db')) 'Partial uninstall deleted profile'
  $checks.Add('real file-lock delete failure stops own instance, disables launch and retains removal receipts/profile for retry')
  & $uninstall
  foreach($id in $registered) { Assert (-not (Test-Path -LiteralPath (Join-Path (Join-Path $destination 'releases') $id))) 'Registered software remains after retry' }
  Assert (@((Marker).ownedReleases).Count -eq 0) 'Completed uninstall retained pending receipts'
  Assert ([IO.File]::ReadAllText((Join-Path $unknown 'sentinel.txt')) -eq 'retained-unowned-diagnostic') 'Unknown diagnostic was removed'
  Assert ([IO.File]::ReadAllText((Join-Path $protected 'sentinel.txt')) -eq 'protected-outside-release') 'Protected sentinel changed'
  $checks.Add('retry removes all three registered releases while preserving database, unknown diagnostics and outside sentinel')
  & $uninstall
  Install $archiveReport.archive $archiveReport.sha256
  & (Join-Path $destination 'start.ps1') -Port 7810
  Assert ((Health).ok) 'Reinstalled retained profile did not start'
  & (Join-Path $destination 'stop.ps1')
  DbSentinel 'check'
  & $uninstall
  $checks.Add('uninstall is repeatable; reinstall starts with retained DB sentinel and can be removed again')
  [IO.File]::WriteAllText($report,(@{status='passed';fixture=$fixture;destination=$destination;checks=@($checks);archiveSha256=$archiveReport.sha256;realScheduledTasks=$false;readersDisabled=$true;limitations=@('unsigned PowerShell review installer, not signed MSI/EXE','upgrade/rollback variants modify manifest only; no different-version DB migration certified','no actual Windows logon or physical tray-click check')} | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
  Write-Host "Review installation passed: $($checks.Count) checks."
} finally {
  if ((Test-Path -LiteralPath (Join-Path $destination 'review-data\review-processes.json')) -and (Marker).active) { & (Join-Path $destination 'stop.ps1') }
}
