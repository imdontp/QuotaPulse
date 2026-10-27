<# Regression checks use a new inert ZIP and disposable owned temp targets. No app is started. #>
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$base=Join-Path ([IO.Path]::GetTempPath()) 'QuotaPulse-install-regression'
. (Join-Path $PSScriptRoot 'review-profile.ps1')
Assert-ReviewPlainPath $base
New-Item -ItemType Directory -Path $base -Force | Out-Null
$fixture=Join-Path $base ('run-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$required=@('scripts/start-review.ps1','scripts/stop-review.ps1','scripts/review-profile.ps1','scripts/install-review.ps1','scripts/uninstall-review.ps1','scripts/task-entry.cjs','packages/daemon/dist/index.js','packages/tray/dist/main.js','node_modules/electron/dist/electron.exe','node_modules/better-sqlite3/build/Release/better_sqlite3.node','packages/web/dist/index.html')
$nested='node_modules/owned-regression/'+('n'*110)+'/value.txt'
function New-Archive([string]$Name,[string]$Extra) {
  $file=Join-Path $fixture $Name
  $archive=[IO.Compression.ZipFile]::Open($file,[IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach($name in @('review-manifest.json')+$required+@($nested)+$(if($Extra){@($Extra)}else{@()})) {
      $entry=$archive.CreateEntry($name)
      $writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false))
      try { $writer.Write($(if($name -eq 'review-manifest.json'){'{"checkpoint":"owned-regression","platform":"win32","arch":"x64","requiredNodeAbi":"127"}'}else{'owned-regression'})) } finally { $writer.Dispose() }
    }
  } finally { $archive.Dispose() }
  return $file
}
function Install([string]$Archive,[string]$Destination) {
  & (Join-Path $PSScriptRoot 'install-review.ps1') -Archive $Archive -ExpectedSha256 (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -Destination $Destination
}
$valid=New-Archive 'valid.zip' ''
$destination=Join-Path $fixture 'installation'
Install $valid $destination
$state=Get-Content -LiteralPath (Join-Path $destination 'installation.json') -Raw | ConvertFrom-Json
$longFile=[IO.Path]::Combine($destination,'releases',$state.active,$nested.Replace('/','\'))
if($longFile.Length -le 260 -or [IO.File]::ReadAllText('\\?\'+$longFile) -ne 'owned-regression'){throw 'Long ZIP entry was not correctly installed'}
$tooLong=Join-Path $fixture ('x'*95)
try { Install $valid $tooLong; throw 'Expected overlong Electron path to be rejected' }
catch { if($_.Exception.Message -notlike '*destination is too long to launch Electron*'){throw} }
if(Test-Path -LiteralPath $tooLong){throw 'Rejected destination was created'}
foreach($name in @('../escape.txt','review-data/unexpected.txt')) {
  $invalid=New-Archive ($(if($name.StartsWith('..')){'traversal.zip'}else{'stateful.zip'})) $name
  $target=Join-Path $fixture ($(if($name.StartsWith('..')){'traversal'}else{'stateful'}))
  try { Install $invalid $target; throw 'Expected unsafe archive to be rejected' }
  catch { if($_.Exception.Message -notlike '*Unsafe or stateful archive entry*'){throw} }
  if(Test-Path -LiteralPath $target){throw 'Unsafe archive created its destination'}
}
$result=@{status='passed';fixture=$fixture;longEntryPathLength=$longFile.Length;checks=@('validated archive with >260-character entry extracts correctly','overlong Electron executable path is rejected before creating a destination','traversal and review-data archive entries are rejected before creating destinations');syntheticOnly=$true;processesStarted=0}
[IO.File]::WriteAllText((Join-Path $fixture 'verification.json'),($result | ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
Write-Host "Long-path installer checks passed: $fixture"
