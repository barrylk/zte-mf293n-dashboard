param([string]$Adb = "adb")

$ErrorActionPreference = "Stop"
$Persistent = (& $Adb shell "if [ -L /usr/zte_web/web ] && [ -d /usr/zte_web/web.stock-beacon ]; then echo yes; else echo no; fi").Trim()
if ($LASTEXITCODE -ne 0) { throw "No authorized ADB device is connected." }

if ($Persistent -eq "yes") {
  & $Adb shell "/mnt/userdata/beacon-tools/restore-stock-permanent.sh"
  if ($LASTEXITCODE -ne 0) { throw "Could not restore the persistent stock web root." }
  Write-Host "The untouched stock ZTE web interface is permanently active again."
  return
}

$CurrentMount = (& $Adb shell "mount | grep 'on /usr/zte_web/web '") -join "`n"
if ($LASTEXITCODE -ne 0) { throw "No authorized ADB device is connected." }

if ($CurrentMount -match "mtdblock7") {
  & $Adb shell "umount /usr/zte_web/web"
  if ($LASTEXITCODE -ne 0) { throw "Could not remove the Beacon bind mount." }
  Write-Host "The untouched stock ZTE web interface is active again."
} else {
  Write-Host "Beacon is not bind-mounted; the stock web interface is already active."
}
