$ErrorActionPreference='Continue'
npm run build -w @quotapulse/web *> tmp/main-heading56-final-build.log
$taskBuildExit=$LASTEXITCODE
if($taskBuildExit -ne 0){exit $taskBuildExit}
$env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
$env:QUOTAPULSE_SIDEBAR_THEME='dark'
try {
 node --import tsx tmp/main-heading56-all8.mts *> tmp/main-heading56-final-native.log
 $taskNativeExit=$LASTEXITCODE
 [ordered]@{stage='terminal';buildExit=$taskBuildExit;nativeExit=$taskNativeExit} | ConvertTo-Json | Set-Content -LiteralPath tmp/main-heading56-final-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
}
exit $taskNativeExit
