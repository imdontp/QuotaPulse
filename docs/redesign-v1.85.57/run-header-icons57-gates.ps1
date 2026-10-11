$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
$taskState | ConvertTo-Json | Set-Content tmp/header-icons57-gates-status.json -Encoding utf8
function Invoke-Heading57Gate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content tmp/header-icons57-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/header-icons57-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content tmp/header-icons57-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Heading57Gate 'nativeThaiDark' { node --import tsx tmp/header-icons57.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-Heading57Gate 'nativeThaiLight' { node --import tsx tmp/header-icons57.mts }
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 foreach($taskScope in @('live','models','alerts')) {
  $env:QUOTAPULSE_CAPTURE_SCOPE=$taskScope
  Invoke-Heading57Gate "$taskScope-FourPairs" { npm run test:stable }
 }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content tmp/header-icons57-gates-status.json -Encoding utf8
} finally {
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit 0
