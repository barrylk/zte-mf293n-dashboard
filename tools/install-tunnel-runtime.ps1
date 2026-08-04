param(
  [Parameter(Mandatory = $true)][ValidatePattern("^[a-z0-9-]+$")][string]$Name,
  [Parameter(Mandatory = $true)][string]$RuntimeBinary,
  [string]$ConfigFile,
  [switch]$RequiresTun,
  [string]$AdbPath = "C:\Users\Administrator\Desktop\platform-tools\adb.exe"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $RuntimeBinary)) { throw "Runtime binary not found: $RuntimeBinary" }
if ($ConfigFile -and -not (Test-Path -LiteralPath $ConfigFile)) { throw "Runtime config not found: $ConfigFile" }
if (-not (Test-Path -LiteralPath $AdbPath)) { throw "ADB was not found at $AdbPath" }
if ((& $AdbPath get-state 2>$null) -ne "device") { throw "Connect the MF293N in ADB mode." }
if ((& $AdbPath shell uname -m).Trim() -ne "armv7l") { throw "The connected device is not the verified ARMv7 MF293N target." }
if ($RequiresTun -and -not ((& $AdbPath shell "test -c /dev/net/tun && echo yes").Trim() -eq "yes")) { throw "This runtime requires /dev/net/tun, which is not available on the current MF293N kernel." }

$sizeKb = [math]::Ceiling((Get-Item -LiteralPath $RuntimeBinary).Length / 1KB)
$freeLine = (& $AdbPath shell "df -k /mnt/userdata | tail -1").Trim() -split "\s+"
$freeKb = [int]$freeLine[3]
if ($sizeKb + 1024 -gt $freeKb) { throw "The runtime needs at least $($sizeKb + 1024) KB, but only $freeKb KB is available." }

$target = "/mnt/userdata/beacon-runtimes/$Name"
& $AdbPath shell "mkdir -p '$target'"
& $AdbPath push $RuntimeBinary "$target/runtime"
if ($ConfigFile) { & $AdbPath push $ConfigFile "$target/config.json" }
& $AdbPath push "$PSScriptRoot\router\tunnel-runtime.sh" "$target/service.sh"
& $AdbPath shell "chmod 700 '$target/runtime' '$target/service.sh'"
if ($LASTEXITCODE -ne 0) { throw "Runtime installation failed." }
Write-Host "Installed $Name into $target. It has not been started automatically."
Write-Host "Start: adb shell $target/service.sh start"
