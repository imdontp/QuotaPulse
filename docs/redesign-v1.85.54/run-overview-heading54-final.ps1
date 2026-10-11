$ErrorActionPreference='Continue'
$taskState=[ordered]@{stage='starting'}
try {
 $env:QUOTAPULSE_SIDEBAR_LANGUAGE='th'
 $env:QUOTAPULSE_SIDEBAR_THEME='light'
 node --import tsx tmp/overview-heading54.mts *> tmp/overview-heading54-thai-light.log
 $taskState['nativeThaiLightExit']=$LASTEXITCODE
 if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
 $env:QUOTAPULSE_CAPTURE_SCOPE='overview'
 npm run test:stable *> tmp/overview-heading54-stable.log
 $taskState['stableExit']=$LASTEXITCODE
 $taskState['stage']='terminal'
 $taskState | ConvertTo-Json | Set-Content -LiteralPath tmp/overview-heading54-final-status.json -Encoding utf8
 exit $LASTEXITCODE
} finally {
 Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE,Env:QUOTAPULSE_SIDEBAR_THEME,Env:QUOTAPULSE_CAPTURE_SCOPE -ErrorAction SilentlyContinue
}
