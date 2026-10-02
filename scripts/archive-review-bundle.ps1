[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$output=Join-Path $root 'screens\tray-recovery'
$built=Get-Content -LiteralPath (Join-Path $output 'bundle-build.json') -Raw | ConvertFrom-Json
$bundle=[IO.Path]::GetFullPath($built.bundle)
$boundary=[IO.Path]::GetFullPath((Join-Path $root 'tmp\review-bundles'))+[IO.Path]::DirectorySeparatorChar
if (-not $bundle.StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase)) { throw 'Bundle is outside the review output directory.' }
if (Test-Path -LiteralPath (Join-Path $bundle 'review-data')) { throw 'Do not archive a used review profile.' }
$files=@(Get-ChildItem -LiteralPath $bundle -File -Recurse -Force)
$links=@(Get-ChildItem -LiteralPath $bundle -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
if ($links.Count) { throw 'Linked files are not allowed in the review archive.' }
$archive=$bundle+'.zip'
if (Test-Path -LiteralPath $archive) { throw 'Archive already exists; build a fresh bundle first.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$writer=[IO.Compression.ZipFile]::Open($archive,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    $relative=$file.FullName.Substring($bundle.Length+1).Replace('\','/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($writer,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $writer.Dispose() }
$zip=[IO.Compression.ZipFile]::OpenRead($archive)
$sha=[Security.Cryptography.SHA256]::Create()
$bytes=[long]0
try {
  $entries=@($zip.Entries | Where-Object { $_.Name })
  if ($entries.Count -ne $files.Count) { throw 'Archive file count differs from the built bundle.' }
  foreach ($file in $files) {
    $relative=$file.FullName.Substring($bundle.Length+1).Replace('\','/')
    $entry=$zip.GetEntry($relative)
    if (-not $entry -or $entry.Length -ne $file.Length) { throw "Archive entry missing or truncated: $relative" }
    $source=[IO.File]::OpenRead($file.FullName)
    $compressed=$entry.Open()
    try {
      $sourceHash=[BitConverter]::ToString($sha.ComputeHash($source))
      $archiveHash=[BitConverter]::ToString($sha.ComputeHash($compressed))
      if ($sourceHash -ne $archiveHash) { throw "Archive bytes differ: $relative" }
    } finally { $source.Dispose(); $compressed.Dispose() }
    $bytes+=$file.Length
  }
  foreach ($required in @('README-REVIEW.txt','review-manifest.json','scripts/start-review.ps1','scripts/stop-review.ps1','scripts/task-entry.cjs','packages/daemon/dist/index.js','packages/tray/dist/main.js','packages/tray/dist-preload/dashboard-preload.js','packages/web/dist/index.html','packages/web/dist/fonts/noto-sans-thai/OFL.txt','packages/web/dist/fonts/noto-sans-thai/NotoSansThai-variable.ttf','third-party-licenses/web/@fontsource-variable/geist/LICENSE','third-party-licenses/web/@fontsource-variable/geist-mono/LICENSE','packages/tray/assets/pets/orbit-bot/manifest.json','node_modules/electron/dist/electron.exe','node_modules/electron/dist/LICENSE','node_modules/better-sqlite3/build/Release/better_sqlite3.node')) {
    if (-not $zip.GetEntry($required)) { throw "Missing runtime requirement: $required" }
  }
} finally { $zip.Dispose(); $sha.Dispose() }
$report=@{status='passed';archive=$archive;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant();archiveBytes=(Get-Item -LiteralPath $archive).Length;fileCount=$files.Count;uncompressedBytes=$bytes;verification='Every ZIP entry decompressed and SHA256-compared with its tested bundle source';containsAppProfile=$false;requiredNodeAbi=$built.requiredNodeAbi;platform=$built.platform;arch=$built.arch;checkpoint=$built.checkpoint}
[IO.File]::WriteAllText((Join-Path $output 'archive-verification.json'),($report | ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
Write-Host "Review ZIP verified: $archive ($($files.Count) files)."
