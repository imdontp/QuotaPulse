$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
function Invoke-Reference56Gate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/main-heading56-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/main-heading56-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/main-heading56-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Reference56Gate 'nativeThaiDark' { node --import tsx tmp/main-heading56.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-Reference56Gate 'nativeThaiLight' { node --import tsx tmp/main-heading56.mts }
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 foreach($taskScope in @('live','models','alerts')) {
  $env:QUOTAPULSE_CAPTURE_SCOPE=$taskScope
  Invoke-Reference56Gate "$taskScope-FourPairs" { npm run test:stable }
 }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/main-heading56-gates-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit 0
