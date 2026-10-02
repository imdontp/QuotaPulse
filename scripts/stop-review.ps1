[CmdletBinding(SupportsShouldProcess)]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$data=Join-Path $root 'review-data'
$statePath=Join-Path $data 'review-processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { return }
$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$entry=Join-Path $PSScriptRoot 'task-entry.cjs'
foreach ($role in @('tray','daemon')) {
  $record=$state.$role
  if (-not $record) { continue }
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.pid)" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  if (-not $process.CommandLine -or -not $process.CommandLine.Contains($entry) -or -not $process.CommandLine.Contains($data) -or -not $process.CommandLine.Contains("--role $role") -or $process.CreationDate.ToUniversalTime().ToString('O') -ne $record.created) { throw "Review $role process identity changed; refusing to stop it." }
  if ($PSCmdlet.ShouldProcess("Review $role PID $($record.pid)",'Stop only the recorded review process')) { Stop-Process -Id $record.pid -Force }
}
Write-Host 'Review stop processed. Data and process records are retained.'
