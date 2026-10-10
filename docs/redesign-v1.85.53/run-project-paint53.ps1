$ErrorActionPreference = 'Continue'
npm run build -w @quotapulse/web *> tmp/project-paint53-build.log
$taskBuildExit=$LASTEXITCODE
[ordered]@{stage='build-terminal';buildExit=$taskBuildExit} | ConvertTo-Json | Set-Content -LiteralPath tmp/project-paint53-status.json -Encoding utf8
if($taskBuildExit -ne 0){exit $taskBuildExit}
$env:QUOTAPULSE_SIDEBAR_LANGUAGE='en'
$env:QUOTAPULSE_SIDEBAR_THEME='dark'
try {
 node --import tsx tmp/project-paint53.mts *> tmp/project-paint53-native.log
 $taskNativeExit=$LASTEXITCODE
 [ordered]@{stage='terminal';buildExit=$taskBuildExit;nativeExit=$taskNativeExit} | ConvertTo-Json | Set-Content -LiteralPath tmp/project-paint53-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
}
exit $taskNativeExit
