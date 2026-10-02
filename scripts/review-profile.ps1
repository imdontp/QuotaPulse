function Assert-ReviewPlainPath([string]$Path) {
  $part=[IO.Path]::GetFullPath($Path)
  while ($part) {
    if (Test-Path -LiteralPath $part) {
      $item=Get-Item -LiteralPath $part -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked review paths are not supported: $part" }
    }
    $parent=Split-Path -Parent $part
    if ($parent -eq $part) { break }
    $part=$parent
  }
}
function Get-ReviewDataPath([string]$RuntimeRoot,[string]$InstallationRoot) {
  Assert-ReviewPlainPath $RuntimeRoot
  if (-not $InstallationRoot) { $data=Join-Path $RuntimeRoot 'review-data'; Assert-ReviewPlainPath $data; return $data }
  if (-not [IO.Path]::IsPathRooted($InstallationRoot)) { throw 'InstallationRoot must be absolute.' }
  $instance=[IO.Path]::GetFullPath($InstallationRoot).TrimEnd('\','/')
  $runtime=[IO.Path]::GetFullPath($RuntimeRoot).TrimEnd('\','/')
  Assert-ReviewPlainPath $instance
  if ((Split-Path -Parent (Split-Path -Parent $runtime)) -ne $instance -or (Split-Path -Leaf (Split-Path -Parent $runtime)) -ne 'releases') { throw 'Runtime is not a release inside this installation.' }
  $marker=Get-Content -LiteralPath (Join-Path $instance 'installation.json') -Raw | ConvertFrom-Json
  if ($marker.schemaVersion -ne 1 -or $marker.mode -ne 'isolated-review' -or $marker.active -ne (Split-Path -Leaf $runtime)) { throw 'Runtime is not the active isolated review release.' }
  $data=Join-Path $instance 'review-data'
  Assert-ReviewPlainPath $data
  return $data
}
