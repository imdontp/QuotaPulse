$ErrorActionPreference='Continue'
npm run build -w @quotapulse/web *> tmp/overview-heading54-accepted-build.log
$taskBuildExit=$LASTEXITCODE
if($taskBuildExit -ne 0){exit $taskBuildExit}
$env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
$env:QUOTAPULSE_SIDEBAR_THEME='dark'
try {
 node --import tsx tmp/overview-heading54.mts *> tmp/overview-heading54-accepted-native.log
 $taskNativeExit=$LASTEXITCODE
 [ordered]@{stage='terminal';buildExit=$taskBuildExit;nativeExit=$taskNativeExit} | ConvertTo-Json | Set-Content -LiteralPath tmp/overview-heading54-accepted-native-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
}
exit $taskNativeExit
