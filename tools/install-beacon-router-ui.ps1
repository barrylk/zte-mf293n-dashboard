param(
  [string]$Adb = "adb",
  [switch]$SkipBuild,
  [switch]$Permanent
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Bundle = Join-Path $ProjectRoot "dist-router"

if (-not $SkipBuild) {
  Push-Location $ProjectRoot
  try { npm run build:router } finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $Bundle "index.html"))) {
  throw "Router bundle is missing. Run npm run build:router first."
}

$Device = & $Adb get-state 2>$null
if ($LASTEXITCODE -ne 0 -or $Device.Trim() -ne "device") {
  throw "No authorized ADB device is connected."
}

$Identity = (& $Adb shell id).Trim()
if ($Identity -notmatch "uid=0") {
  throw "ADB is connected but does not have root access: $Identity"
}

if ($Permanent) {
  $MakePermanent = Join-Path $PSScriptRoot "router\make-beacon-permanent.sh"
  $RestorePermanent = Join-Path $PSScriptRoot "router\restore-stock-permanent.sh"
  & $Adb shell "mkdir -p /mnt/userdata/beacon-web /mnt/userdata/beacon-tools; if [ -d /usr/zte_web/web.stock-beacon ]; then cp -a /usr/zte_web/web.stock-beacon/. /mnt/userdata/beacon-web/; else cp -a /usr/zte_web/web/. /mnt/userdata/beacon-web/; fi"
  if ($LASTEXITCODE -ne 0) { throw "Could not preserve the stock web resources." }
  & $Adb push "$Bundle\." "/mnt/userdata/beacon-web/"
  if ($LASTEXITCODE -ne 0) { throw "Could not stage the Beacon bundle." }
  & $Adb push $MakePermanent "/mnt/userdata/beacon-tools/make-beacon-permanent.sh"
  & $Adb push $RestorePermanent "/mnt/userdata/beacon-tools/restore-stock-permanent.sh"
  if ($LASTEXITCODE -ne 0) { throw "Could not install the recovery tools." }
  & $Adb shell "chmod 700 /mnt/userdata/beacon-tools/*.sh; /mnt/userdata/beacon-tools/make-beacon-permanent.sh"
  if ($LASTEXITCODE -ne 0) { throw "The persistent web-root switch failed." }
  Write-Host "Beacon is permanently active. The original UI is retained at /usr/zte_web/web.stock-beacon."
  Write-Host "Open http://192.168.1.1/"
  return
}

& $Adb shell "mkdir -p /mnt/userdata/beacon-ui"
if ($LASTEXITCODE -ne 0) { throw "Could not create /mnt/userdata/beacon-ui." }

& $Adb push "$Bundle\." "/mnt/userdata/beacon-ui/"
if ($LASTEXITCODE -ne 0) { throw "Could not stage the Beacon bundle." }

$CurrentMount = (& $Adb shell "mount | grep 'on /usr/zte_web/web '") -join "`n"
if ($CurrentMount -match "mtdblock7") {
  & $Adb shell "umount /usr/zte_web/web"
  if ($LASTEXITCODE -ne 0) { throw "Could not refresh the existing Beacon bind mount." }
}

& $Adb shell "mount --bind /mnt/userdata/beacon-ui /usr/zte_web/web"
if ($LASTEXITCODE -ne 0) { throw "Could not activate the Beacon web root." }

$VerifiedMount = (& $Adb shell "mount | grep 'on /usr/zte_web/web '") -join "`n"
if ($VerifiedMount -notmatch "mtdblock7") { throw "The Beacon bind mount was not verified." }

Write-Host "Beacon is active on the router. Open http://192.168.1.1/"
Write-Host "The stock UI remains unchanged underneath the bind mount."
Write-Host "This safe activation is intentionally cleared by a router reboot."
