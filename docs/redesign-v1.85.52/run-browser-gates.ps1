$ErrorActionPreference = 'Continue'
$taskState = [ordered]@{ stage = 'starting' }
$taskStatusPath = 'tmp/reference-52-raster-process-status.json'
function Invoke-TaskGate {
    param([string]$TaskName, [scriptblock]$TaskAction)
    $taskState['stage'] = "$TaskName-running"
    $taskState | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding utf8
    & $TaskAction *> "tmp/reference-52-raster-$TaskName.log"
    $taskGateExit = $LASTEXITCODE
    $taskState["${TaskName}Exit"] = $taskGateExit
    $taskState['stage'] = "$TaskName-terminal"
    $taskState | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding utf8
    if ($taskGateExit -ne 0) { exit $taskGateExit }
}
try {
    $env:QUOTAPULSE_CAPTURE_SCOPE = 'models'
    $env:QUOTAPULSE_CAPTURE_THEME = 'dark'
    Remove-Item -LiteralPath Env:QUOTAPULSE_CAPTURE_LANGUAGE -ErrorAction SilentlyContinue
    Invoke-TaskGate 'focus' { npm run test:stable }
} finally {
    Remove-Item -LiteralPath Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath Env:QUOTAPULSE_CAPTURE_THEME -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath Env:QUOTAPULSE_CAPTURE_LANGUAGE -ErrorAction SilentlyContinue
}
$env:QUOTAPULSE_SIDEBAR_LANGUAGE = 'en'
$env:QUOTAPULSE_SIDEBAR_THEME = 'dark'
Invoke-TaskGate 'native' { node --import tsx tmp/sidebar-native52.mts }
$env:QUOTAPULSE_SIDEBAR_LANGUAGE = 'th'
$env:QUOTAPULSE_SIDEBAR_THEME = 'light'
Invoke-TaskGate 'thaiLight' { node --import tsx tmp/sidebar-native52.mts }
Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE -ErrorAction SilentlyContinue
Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
Invoke-TaskGate 'quickStats' { npm run test:quickstats }
Invoke-TaskGate 'ui' { npm run test:ui }
Invoke-TaskGate 'matrix' { npm run test:stable }
$taskState['stage'] = 'all-terminal'
$taskState | ConvertTo-Json | Set-Content -LiteralPath $taskStatusPath -Encoding utf8
exit 0
