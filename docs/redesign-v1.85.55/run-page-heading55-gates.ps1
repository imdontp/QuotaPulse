$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
function Invoke-HeadingFinalGate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/page-heading55-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/page-heading55-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/page-heading55-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-HeadingFinalGate 'nativeAll8' { node --import tsx tmp/page-heading55-all8.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-HeadingFinalGate 'nativeThaiDark' { node --import tsx tmp/page-heading55.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-HeadingFinalGate 'nativeThaiLight' { node --import tsx tmp/page-heading55-quick.mts }
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 Invoke-HeadingFinalGate 'ui' { npm run test:ui }
 Invoke-HeadingFinalGate 'matrix' { npm run test:stable }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/page-heading55-gates-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
}
exit 0
