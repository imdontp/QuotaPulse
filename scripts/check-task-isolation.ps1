# Synthetic ScheduledTask definitions only. Every task cmdlet is shadowed below.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$output = Join-Path $repo 'screens\task-isolation'
New-Item -ItemType Directory -Path $output -Force | Out-Null
Remove-Item -LiteralPath (Join-Path $output 'verification.json') -Force -ErrorAction SilentlyContinue
$fixture = Join-Path $repo ('tmp\task isolation-' + [guid]::NewGuid().ToString('N'))
$scripts = Join-Path $fixture 'scripts'
New-Item -ItemType Directory -Path $scripts -Force | Out-Null
foreach ($name in @('install-task.ps1','uninstall-task.ps1','run-task.ps1')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $scripts }
foreach ($role in @('daemon','tray')) { New-Item -ItemType Directory -Path (Join-Path $fixture "packages\$role\dist") -Force | Out-Null }
[IO.File]::WriteAllText((Join-Path $fixture 'packages\daemon\dist\index.js'), 'console.log(JSON.stringify({port:process.env.QUOTAPULSE_PORT,dataDir:process.env.QUOTAPULSE_DATA_DIR}))')
[IO.File]::WriteAllText((Join-Path $fixture 'packages\tray\dist\main.js'), '// synthetic build marker; never launched')
$install = Join-Path $scripts 'install-task.ps1'
$uninstall = Join-Path $scripts 'uninstall-task.ps1'
$thai = -join @([char]0x0E17,[char]0x0E14,[char]0x0E2A,[char]0x0E2D,[char]0x0E1A)
$data = Join-Path $fixture ('review data ' + $thai)
New-Item -ItemType Directory -Path $data -Force | Out-Null
$sentinel = Join-Path $data 'sentinel.txt'
[IO.File]::WriteAllText($sentinel, 'retain synthetic data')
$global:qpMockTasks = @{}
$global:qpMockWrites = [Collections.Generic.List[string]]::new()
$global:qpMockFailName = ''
$global:qpMockChecks = [Collections.Generic.List[string]]::new()
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Reset {
  $global:qpMockTasks = @{}
  foreach ($name in @('quotapulse-daemon','quotapulse-tray','plimsoll-daemon','plimsoll-tray','usage-trend-daemon','usage-trend-tray','unrelated-electron')) { $global:qpMockTasks[$name] = [pscustomobject]@{ TaskName=$name; Xml="original:$name" } }
  $global:qpMockWrites.Clear(); $global:qpMockFailName = ''
}
function Get-ScheduledTask { [CmdletBinding()]param($TaskPath,$TaskName) Assert ($TaskPath -eq '\') 'Task query must specify root path'; return $global:qpMockTasks[$TaskName] }
function Export-ScheduledTask { [CmdletBinding()]param($TaskPath,$TaskName) Assert ($TaskPath -eq '\') 'Export path'; return $global:qpMockTasks[$TaskName].Xml }
function New-ScheduledTaskAction { param($Execute,$Argument,$WorkingDirectory) return [pscustomobject]@{ Execute=$Execute; Arguments=$Argument; WorkingDirectory=$WorkingDirectory } }
function New-ScheduledTaskTrigger { param([switch]$AtLogOn,$User) return [pscustomobject]@{ Delay=''; User=$User } }
function New-ScheduledTaskPrincipal { param($UserId,$LogonType,$RunLevel) return [pscustomobject]@{ UserId=$UserId } }
function New-ScheduledTaskSettingsSet { param([switch]$AllowStartIfOnBatteries,[switch]$DontStopIfGoingOnBatteries,[switch]$StartWhenAvailable,$RestartCount,$RestartInterval,$ExecutionTimeLimit) return [pscustomobject]@{ RestartCount=$RestartCount } }
function Register-ScheduledTask {
  [CmdletBinding()]param($TaskPath,$TaskName,$Action,$Trigger,$Principal,$Settings,$Description,$Xml,[switch]$Force)
  Assert ($TaskPath -eq '\') 'Register path'
  $global:qpMockWrites.Add("register:$TaskName")
  $global:qpMockTasks[$TaskName] = [pscustomobject]@{ TaskName=$TaskName; Xml=$Xml; Action=$Action }
  if ($global:qpMockFailName -eq $TaskName -and -not $Xml) { $global:qpMockFailName=''; throw 'Synthetic partial registration failure' }
}
function Unregister-ScheduledTask { [CmdletBinding(SupportsShouldProcess)]param($TaskPath,$TaskName) Assert ($TaskPath -eq '\') 'Remove path'; $global:qpMockWrites.Add("remove:$TaskName"); $global:qpMockTasks.Remove($TaskName) }
function Stop-ScheduledTask { [CmdletBinding()]param($TaskPath,$TaskName) Assert ($TaskPath -eq '\') 'Stop path'; $global:qpMockWrites.Add("stop:$TaskName") }
function PreserveOriginals {
  foreach ($name in @('quotapulse-daemon','quotapulse-tray','plimsoll-daemon','plimsoll-tray','usage-trend-daemon','usage-trend-tray','unrelated-electron')) { Assert ($global:qpMockTasks[$name].Xml -eq "original:$name") "Original changed: $name" }
  Assert ([IO.File]::ReadAllText($sentinel) -eq 'retain synthetic data') 'Data sentinel changed'
}
function Reject($arguments) {
  $before = $global:qpMockWrites.Count; $rejected=$false
  try { & $install @arguments | Out-Null } catch { $rejected=$true }
  Assert $rejected 'Expected installer rejection'; Assert ($global:qpMockWrites.Count -eq $before) 'Rejected plan mutated definitions'
}
Reset
& $install -InstanceName quotapulse-review -DataDir $data -Port 7805 -WhatIf
Assert ($global:qpMockWrites.Count -eq 0) 'WhatIf wrote tasks'
$global:qpMockChecks.Add('install WhatIf makes no definition changes')
foreach ($arguments in @(
  @{InstanceName='quotapulse-review';Port=7805},
  @{InstanceName='quotapulse-review';DataDir=$data},
  @{InstanceName='quotapulse-review';DataDir='relative';Port=7805},
  @{InstanceName='quotapulse-review';DataDir=[IO.Path]::GetPathRoot($fixture);Port=7805},
  @{InstanceName='quotapulse-review';DataDir=(Join-Path $env:LOCALAPPDATA 'quotapulse');Port=7805},
  @{InstanceName='quotapulse-review';DataDir=(Join-Path $env:LOCALAPPDATA 'quotapulse\nested');Port=7805},
  @{InstanceName='quotapulse-review';DataDir=$env:LOCALAPPDATA;Port=7805},
  @{InstanceName='quotapulse-review';DataDir=($data + "`n");Port=7805},
  @{InstanceName='quotapulse-review';DataDir=($data + '"');Port=7805},
  @{InstanceName='invalid';DataDir=$data;Port=7805}
)) { Reject $arguments }
Reject @{Replace=$true;NoTray=$true}
$global:qpMockChecks.Add('invalid or shared paths and default-port collisions rejected before mutation')
& $install -InstanceName quotapulse-review -DataDir $data -Port 7805
foreach ($role in @('daemon','tray')) {
  $action = $global:qpMockTasks["quotapulse-review-$role"].Action
  Assert ($action.Arguments.Contains('-Port 7805')) 'Port missing from action'
  Assert ($action.Arguments.Contains('-DataDir "' + $data + '"')) 'Data directory not quoted'
  Assert ($action.Arguments.Contains('-File "' + (Join-Path $scripts 'run-task.ps1') + '"')) 'Runner not quoted'
  Assert ($action.WorkingDirectory -eq $fixture) 'Action points to another checkout'
}
PreserveOriginals
Reject @{InstanceName='quotapulse-review';DataDir=$data;Port=7805}
$global:qpMockChecks.Add('named tasks use this checkout, quoted paths and selected port; replacement requires Replace')
$global:qpMockWrites.Clear()
& $uninstall -InstanceName quotapulse-review -StopRunning -WhatIf
Assert ($global:qpMockWrites.Count -eq 0) 'Uninstall WhatIf wrote tasks'
& $uninstall -InstanceName quotapulse-review -StopRunning
Assert (($global:qpMockWrites -join ',') -eq 'stop:quotapulse-review-tray,remove:quotapulse-review-tray,stop:quotapulse-review-daemon,remove:quotapulse-review-daemon') 'Removal scope/order mismatch'
PreserveOriginals
$global:qpMockChecks.Add('uninstall WhatIf and tray-before-daemon scoped stop/removal retain original definitions and data')
Reset
& $install -InstanceName quotapulse-review -DataDir $data -Port 7805 -NoTray
Assert ($global:qpMockTasks.ContainsKey('quotapulse-review-daemon') -and -not $global:qpMockTasks.ContainsKey('quotapulse-review-tray')) 'NoTray registered tray'
$global:qpMockChecks.Add('NoTray registers only daemon')
Reset; $global:qpMockFailName='quotapulse-review-tray'
try { & $install -InstanceName quotapulse-review -DataDir $data -Port 7805; throw 'Expected synthetic failure' } catch { Assert ($_.Exception.Message -match 'Synthetic partial') 'Unexpected rollback error' }
Assert (-not $global:qpMockTasks.ContainsKey('quotapulse-review-daemon') -and -not $global:qpMockTasks.ContainsKey('quotapulse-review-tray')) 'New-task rollback incomplete'
PreserveOriginals
Reset
foreach ($role in @('daemon','tray')) { $global:qpMockTasks["quotapulse-review-$role"] = [pscustomobject]@{ Xml="backup:$role" } }
$global:qpMockFailName='quotapulse-review-tray'
try { & $install -InstanceName quotapulse-review -DataDir $data -Port 7805 -Replace; throw 'Expected synthetic failure' } catch { Assert ($_.Exception.Message -match 'Synthetic partial') 'Unexpected replacement error' }
foreach ($role in @('daemon','tray')) { Assert ($global:qpMockTasks["quotapulse-review-$role"].Xml -eq "backup:$role") 'Replacement rollback incomplete' }
PreserveOriginals
$global:qpMockChecks.Add('partial registration rollback removes new tasks and restores replaced XML definitions')
# Run only the copied runner against a synthetic JS entry, never the daemon/tray.
$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$previousPort=$env:QUOTAPULSE_PORT; $previousData=$env:QUOTAPULSE_DATA_DIR
$result = & $ps -NoProfile -NonInteractive -File (Join-Path $scripts 'run-task.ps1') -Role daemon -Port 7805 -DataDir $data
Assert ($LASTEXITCODE -eq 0) 'Synthetic runner failed'
$runtime = $result | ConvertFrom-Json
Assert ($runtime.port -eq '7805' -and $runtime.dataDir -eq $data) 'Runtime environment mismatch'
Assert ($env:QUOTAPULSE_PORT -eq $previousPort -and $env:QUOTAPULSE_DATA_DIR -eq $previousData) 'Parent environment changed'
$global:qpMockChecks.Add('copied runner forwards port/data directory only to child environment')
# The tray runner resolves Electron but its launch is replaced by a local function.
$bootstrap = Join-Path $fixture 'tray-runner-mock.ps1'
$bootstrapCode = @'
param($Runner,$DataDir)
$env:ELECTRON_RUN_AS_NODE='synthetic-parent-value'
function Start-Process {
  [CmdletBinding()]param($FilePath,$ArgumentList,$WorkingDirectory,$WindowStyle,[switch]$Wait,[switch]$PassThru)
  [Console]::WriteLine((@{file=$FilePath;arguments=$ArgumentList;workingDirectory=$WorkingDirectory;windowStyle=$WindowStyle;wait=[bool]$Wait;passThru=[bool]$PassThru;port=$env:QUOTAPULSE_PORT;dataDir=$env:QUOTAPULSE_DATA_DIR;runAsNode=$env:ELECTRON_RUN_AS_NODE} | ConvertTo-Json -Compress))
  return [pscustomobject]@{ExitCode=23}
}
& $Runner -Role tray -Port 7805 -DataDir $DataDir
exit $LASTEXITCODE
'@
[IO.File]::WriteAllText($bootstrap, $bootstrapCode)
$result = & $ps -NoProfile -NonInteractive -File $bootstrap -Runner (Join-Path $scripts 'run-task.ps1') -DataDir $data
Assert ($LASTEXITCODE -eq 23) 'Tray runner did not propagate synthetic exit code'
$runtime = $result | ConvertFrom-Json
Assert ($runtime.port -eq '7805' -and $runtime.dataDir -eq $data -and -not $runtime.runAsNode) 'Tray child environment mismatch'
Assert ($runtime.windowStyle -eq 'Hidden' -and $runtime.wait -and $runtime.passThru) 'Tray runner launch options mismatch'
Assert ($runtime.arguments -eq ('"' + (Join-Path $fixture 'packages\tray\dist\main.js') + '"')) 'Tray entry not quoted'
Assert ($runtime.workingDirectory -eq $fixture -and (Test-Path -LiteralPath $runtime.file)) 'Tray executable/working directory mismatch'
$global:qpMockChecks.Add('tray runner quotes entry, forwards environment, clears run-as-node, waits hidden and propagates exit code through mocked launch')
$report = @{ status='passed'; checks=@($global:qpMockChecks.ToArray()); fixture=$fixture; limitations=@('All ScheduledTask cmdlets mocked; no real tasks queried or modified','Tray runner and installed task/process lifecycle require separate approved manual validation') } | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText((Join-Path $output 'verification.json'), $report, [Text.UTF8Encoding]::new($false))
Write-Host "Task isolation passed: $($global:qpMockChecks.Count) checks; no real Scheduled Tasks used."
