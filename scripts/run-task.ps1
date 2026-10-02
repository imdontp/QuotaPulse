<# Process-local settings; no machine/user environment writes. #>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('daemon','tray')][string]$Role,
  [ValidateRange(1024,65535)][int]$Port = 7676,
  [switch]$NoReaders,
  [string]$DataDir
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$env:QUOTAPULSE_PORT = [string]$Port
if ($DataDir) { $env:QUOTAPULSE_DATA_DIR = $DataDir }
if ($NoReaders) { $env:QUOTAPULSE_READERS = 'off' }
$node = (Get-Command node -ErrorAction Stop).Source
$env:QUOTAPULSE_NODE_EXE = $node
if ($Role -eq 'daemon') {
  $entry = Join-Path $repo 'packages\daemon\dist\index.js'
  if (-not (Test-Path -LiteralPath $entry)) { throw 'Daemon build missing' }
  & $node $entry
  exit $LASTEXITCODE
}
Push-Location -LiteralPath $repo
try { $electron = & $node -p "require('electron')" } finally { Pop-Location }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $electron)) { throw 'Electron executable missing' }
$entry = Join-Path $repo 'packages\tray\dist\main.js'
if (-not (Test-Path -LiteralPath $entry)) { throw 'Tray build missing' }
$env:ELECTRON_RUN_AS_NODE = $null
$process = Start-Process -FilePath $electron -ArgumentList ('"' + $entry + '"') -WorkingDirectory $repo -WindowStyle Hidden -Wait -PassThru
exit $process.ExitCode
