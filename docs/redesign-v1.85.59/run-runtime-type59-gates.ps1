$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
function Invoke-Runtime59Gate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content tmp/runtime-type59-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/runtime-type59-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content tmp/runtime-type59-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Runtime59Gate 'nativeEn' { node --import tsx tmp/runtime-type59.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 Invoke-Runtime59Gate 'nativeThaiDark' { node --import tsx tmp/runtime-type59.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-Runtime59Gate 'nativeThaiLight' { node --import tsx tmp/runtime-type59.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Runtime59Gate 'nativeAll8' { node --import tsx tmp/runtime-type59-all8.mts }
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 $env:QUOTAPULSE_CAPTURE_SCOPE='overview'
 Invoke-Runtime59Gate 'FourPairs' { npm run test:stable }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content tmp/runtime-type59-gates-status.json -Encoding utf8
} finally {
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit 0
