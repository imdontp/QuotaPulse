$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
function Invoke-Cost60Gate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content tmp/cost-type60-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/cost-type60-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content tmp/cost-type60-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Cost60Gate 'nativeEn' { node --import tsx tmp/cost-type60.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 Invoke-Cost60Gate 'nativeThaiDark' { node --import tsx tmp/cost-type60.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-Cost60Gate 'nativeThaiLight' { node --import tsx tmp/cost-type60.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Cost60Gate 'nativeAll8' { node --import tsx tmp/cost-type60-all8.mts }
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 $env:QUOTAPULSE_CAPTURE_SCOPE='cost'
 Invoke-Cost60Gate 'FourPairs' { npm run test:stable }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content tmp/cost-type60-gates-status.json -Encoding utf8
} finally {
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit 0
