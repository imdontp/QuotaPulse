$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
$taskState | ConvertTo-Json | Set-Content tmp/project-rhythm58-gates-status.json -Encoding utf8
function Invoke-Project58Gate {
 param([string]$TaskName,[scriptblock]$TaskAction)
 $taskState['stage']="$TaskName-running"
 $taskState | ConvertTo-Json | Set-Content tmp/project-rhythm58-gates-status.json -Encoding utf8
 & $TaskAction *> "tmp/project-rhythm58-$TaskName.log"
 $taskExit=$LASTEXITCODE
 $taskState["${TaskName}Exit"]=$taskExit
 $taskState['stage']="$TaskName-terminal"
 $taskState | ConvertTo-Json | Set-Content tmp/project-rhythm58-gates-status.json -Encoding utf8
 if($taskExit -ne 0){exit $taskExit}
}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Project58Gate 'nativeThaiDark' { node --import tsx tmp/project-rhythm58.mts }
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 Invoke-Project58Gate 'nativeThaiLight' { node --import tsx tmp/project-rhythm58.mts }
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
 $env:QUOTAPULSE_SIDEBAR_THEME='dark'
 Invoke-Project58Gate 'nativeAll8' { node --import tsx tmp/project-rhythm58-all8.mts }
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 $env:QUOTAPULSE_CAPTURE_SCOPE='projects'
 Invoke-Project58Gate 'FourPairs' { npm run test:stable }
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content tmp/project-rhythm58-gates-status.json -Encoding utf8
} finally {
 Remove-Item Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit 0
