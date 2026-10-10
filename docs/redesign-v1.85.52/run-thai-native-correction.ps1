$ErrorActionPreference = 'Continue'
$env:QUOTAPULSE_SIDEBAR_LANGUAGE = 'th'
$env:QUOTAPULSE_SIDEBAR_THEME = 'light'
try {
    node --import tsx tmp/sidebar-native52.mts *> tmp/reference-52-raster-thaiLight-corrected.log
    $taskGateExit = $LASTEXITCODE
    [ordered]@{ stage='terminal'; exitCode=$taskGateExit; language='th'; theme='light'; reason='Original pipeline set capture variables but the native helper reads sidebar variables.' } | ConvertTo-Json | Set-Content -LiteralPath tmp/reference-52-raster-thaiLight-corrected-status.json -Encoding utf8
} finally {
    Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_LANGUAGE -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath Env:QUOTAPULSE_SIDEBAR_THEME -ErrorAction SilentlyContinue
}
exit $taskGateExit
