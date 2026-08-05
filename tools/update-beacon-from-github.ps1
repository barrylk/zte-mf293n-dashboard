param(
  [string]$Repository = "barrylk/zte-mf293n-dashboard",
  [string]$AdbPath = "C:\Users\Administrator\Desktop\platform-tools\adb.exe"
)

$ErrorActionPreference = "Stop"
$targetRoot = "/mnt/userdata"
$activePath = "$targetRoot/beacon-web"
$stagingPath = "$targetRoot/beacon-web.next"
$previousPath = "$targetRoot/beacon-web.previous"
$activeTools = "$targetRoot/beacon-tools"
$stagingTools = "$targetRoot/beacon-tools.next"
$previousTools = "$targetRoot/beacon-tools.previous"
$headers = @{ "User-Agent" = "Beacon-MF293N-Updater"; Accept = "application/vnd.github+json" }

if (-not (Test-Path -LiteralPath $AdbPath)) { throw "ADB was not found at $AdbPath" }
$device = & $AdbPath get-state 2>$null
if ($device -ne "device") { throw "Connect the MF293N in ADB mode before updating." }
$identity = & $AdbPath shell id
if ($identity -notmatch "uid=0") { throw "The connected MF293N ADB session is not running as root." }

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $headers
$packageAsset = $release.assets | Where-Object name -eq "beacon-router-ui.zip" | Select-Object -First 1
$checksumAsset = $release.assets | Where-Object name -eq "beacon-router-ui.zip.sha256" | Select-Object -First 1
if (-not $packageAsset -or -not $checksumAsset) { throw "The latest release does not contain the Beacon OTA package and checksum." }

$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("beacon-update-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
  $archive = Join-Path $temporary "beacon-router-ui.zip"
  $checksumFile = Join-Path $temporary "beacon-router-ui.zip.sha256"
  Invoke-WebRequest -Uri $packageAsset.browser_download_url -Headers $headers -OutFile $archive
  Invoke-WebRequest -Uri $checksumAsset.browser_download_url -Headers $headers -OutFile $checksumFile
  $expected = ((Get-Content -LiteralPath $checksumFile -Raw) -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Beacon package checksum verification failed." }
  $expanded = Join-Path $temporary "web"
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $webPayload = Join-Path $expanded "web"
  $toolsPayload = Join-Path $expanded "router-tools"
  # v0.2.0 packages placed the web files at the archive root.
  if (-not (Test-Path -LiteralPath (Join-Path $webPayload "index.html"))) { $webPayload = $expanded }
  if (-not (Test-Path -LiteralPath (Join-Path $webPayload "index.html"))) { throw "The update package has no web/index.html." }
  & $AdbPath shell "rm -rf '$stagingPath' '$stagingTools'; mkdir -p '$stagingPath' '$stagingTools'"
  if ($LASTEXITCODE -ne 0) { throw "Could not prepare router staging storage." }
  & $AdbPath push "$webPayload\." "$stagingPath/"
  if ($LASTEXITCODE -ne 0) { throw "Could not upload the Beacon update." }
  $hasTools = Test-Path -LiteralPath (Join-Path $toolsPayload "beacon-agent.sh")
  if ($hasTools) {
    & $AdbPath push "$toolsPayload\." "$stagingTools/"
    if ($LASTEXITCODE -ne 0) { throw "Could not upload the Beacon device tools." }
  }
  $activation = "test -f '$stagingPath/index.html' && rm -rf '$previousPath' && mv '$activePath' '$previousPath' && mv '$stagingPath' '$activePath'"
  if ($hasTools) {
    $activation += " && chmod 755 '$stagingTools/beacon-agent.sh' && rm -rf '$previousTools' && if [ -d '$activeTools' ]; then mv '$activeTools' '$previousTools'; fi && mv '$stagingTools' '$activeTools'"
  }
  $activation += " && ln -sf /tmp/beacon-system.json '$activePath/beacon-system.json'"
  & $AdbPath shell $activation
  if ($LASTEXITCODE -ne 0) { throw "Router activation failed. The previous UI was not intentionally removed." }
  if ($hasTools) {
    $rcLocal = Join-Path $temporary "router-rc"
    & $AdbPath pull /etc/rc $rcLocal
    if ($LASTEXITCODE -ne 0) { throw "Beacon was updated, but /etc/rc could not be read." }
    $latin1 = [System.Text.Encoding]::GetEncoding(28591)
    $rcText = [System.IO.File]::ReadAllText($rcLocal, $latin1)
    $hookText = (Get-Content -LiteralPath (Join-Path $toolsPayload "rc-hook.sh") -Raw).Replace("`r`n", "`n").TrimEnd() + "`n"
    $marker = '(?ms)^# BEACON_AGENT_BEGIN\r?\n.*?^# BEACON_AGENT_END\r?\n?'
    if ([regex]::IsMatch($rcText, $marker)) { $rcText = [regex]::Replace($rcText, $marker, $hookText, 1) }
    else { $rcText = $rcText.TrimEnd("`r", "`n") + "`n" + $hookText }
    [System.IO.File]::WriteAllText($rcLocal, $rcText, $latin1)
    & $AdbPath push $rcLocal /tmp/rc.beacon-update
    if ($LASTEXITCODE -ne 0) { throw "Beacon was updated, but its boot hook could not be staged." }
    & $AdbPath shell "/bin/sh -n /tmp/rc.beacon-update && mount -o remount,rw /dev/root / && if [ ! -f /etc/rc.pre-beacon ]; then cp /etc/rc /etc/rc.pre-beacon; fi && cp /tmp/rc.beacon-update /etc/rc && chmod 755 /etc/rc && /bin/sh -n /etc/rc && sync && mount -o remount,ro /dev/root /"
    if ($LASTEXITCODE -ne 0) { throw "Beacon was updated, but its boot hook could not be installed safely." }
  }
  Write-Host "Beacon $($release.tag_name) installed. Reload http://192.168.1.1/index.html"
  Write-Host "Rollback copies: $previousPath and $previousTools"
} finally {
  Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
