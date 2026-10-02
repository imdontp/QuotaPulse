[CmdletBinding(SupportsShouldProcess)]
param([string]$InstallationRoot)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'review-profile.ps1')
$data=Get-ReviewDataPath $root $InstallationRoot
$statePath=Join-Path $data 'review-processes.json'
if (-not (Test-Path -LiteralPath $statePath)) { return }
$state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$entry=Join-Path $PSScriptRoot 'task-entry.cjs'
$stopped=$false
foreach ($role in @('tray','daemon')) {
  $record=$state.$role
  if (-not $record) { continue }
  $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.pid)" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  if (-not $process.CommandLine -or -not $process.CommandLine.Contains($entry) -or -not $process.CommandLine.Contains($data) -or -not $process.CommandLine.Contains("--role $role") -or $process.CreationDate.ToUniversalTime().ToString('O') -ne $record.created) { throw "Review $role process identity changed; refusing to stop it." }
  if ($PSCmdlet.ShouldProcess("Review $role PID $($record.pid)",'Stop only the recorded review process')) { Stop-Process -Id $record.pid -Force; $stopped=$true }
}
if ($stopped) {
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  do {
    $remaining=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') -and $_.CommandLine -and $_.CommandLine.Contains($data) })
    if (-not $remaining.Count) { break }
    Start-Sleep -Milliseconds 200
  } while ([DateTime]::UtcNow -lt $deadline)
  if ($remaining.Count) { throw "Review processes are still shutting down (PIDs: $($remaining.ProcessId -join ',')). Data retained; retry after they exit." }
}
Write-Host 'Review stop processed. Data and process records are retained.'
