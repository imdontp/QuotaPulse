$ErrorActionPreference='Continue'
$env:QUOTAPULSE_CAPTURE_SCOPE='projects'
try {
 npm run test:stable *> tmp/project-paint53-stable.log
 $taskStableExit=$LASTEXITCODE
 [ordered]@{stage='terminal';exitCode=$taskStableExit;scope='projects'} | ConvertTo-Json | Set-Content -LiteralPath tmp/project-paint53-stable-status.json -Encoding utf8
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
exit $taskStableExit
