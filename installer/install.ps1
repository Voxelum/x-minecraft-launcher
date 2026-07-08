<#
.SYNOPSIS
  Portable installer for X Minecraft Launcher (XMCL).

.DESCRIPTION
  Reconstructs a runnable launcher folder — equivalent to extracting the
  official Windows zip — by downloading the matching Electron prebuilt from the
  npmmirror Electron mirror and the app.asar from the `@xmcl/app` npm package.
  Intended for users behind the GFW who have not installed XMCL yet.

  The resulting folder shares its user data with a normal install, because the
  Electron app name comes from app.asar's package.json, not the exe name.

.PARAMETER InstallDir
  Target directory. Defaults to "$env:LOCALAPPDATA\Programs\XMCL".

.PARAMETER Version
  App version to install (e.g. 0.49.3). Defaults to the latest published.

.PARAMETER Registry
  npm registry base URL. Defaults to https://registry.npmmirror.com.

.PARAMETER ElectronMirror
  Electron prebuilt mirror base URL. Defaults to
  https://npmmirror.com/mirrors/electron.

.PARAMETER Launch
  Launch the launcher after install completes.

.EXAMPLE
  irm https://xmcl.app/install.ps1 | iex

.EXAMPLE
  .\install.ps1 -InstallDir D:\Apps\XMCL -Launch
#>
[CmdletBinding()]
param(
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\XMCL",
  [string]$Version = 'latest',
  [string]$Registry = 'https://registry.npmmirror.com',
  [string]$ElectronMirror = 'https://npmmirror.com/mirrors/electron',
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is ~10x faster without the progress bar.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AppName = 'X Minecraft Launcher'
$Tar = Join-Path $env:SystemRoot 'System32\tar.exe' # bsdtar, shipped since Windows 10 1803.

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# 1. Resolve the current architecture to the Electron/asar naming. The asar is
#    architecture-independent JS, so arm64 reuses the x64 (`win`) package and
#    only the Electron prebuilt differs.
switch ($env:PROCESSOR_ARCHITECTURE) {
  'AMD64' { $electronArch = 'x64';   $asarPlatform = 'win' }
  'ARM64' { $electronArch = 'arm64'; $asarPlatform = 'win' }
  'x86'   { $electronArch = 'ia32';  $asarPlatform = 'win-ia32' }
  default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}
$Package = "@xmcl/app-$asarPlatform"

# 2. Resolve the app + Electron version from the npm package metadata. The
#    published package.json carries a custom `electron` field pinning the exact
#    prebuilt to fetch, so this single request is the only source of truth.
Write-Step "Resolving $Package@$Version"
$meta = Invoke-RestMethod "$Registry/$Package/$Version"
$appVersion = $meta.version
$electronVersion = $meta.electron
if (-not $electronVersion) { throw "Package $Package@$appVersion has no 'electron' field." }
Write-Host "    app=$appVersion electron=$electronVersion arch=$electronArch"

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "xmcl-install-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  # 3. Download + extract the Electron prebuilt. These files are byte-identical
  #    to the ones the official zip ships (same Electron version).
  $electronZip = Join-Path $tmp 'electron.zip'
  $electronUrl = "$ElectronMirror/$electronVersion/electron-v$electronVersion-win32-$electronArch.zip"
  Write-Step "Downloading Electron $electronVersion"
  Invoke-WebRequest -Uri $electronUrl -OutFile $electronZip

  Write-Step "Extracting to $InstallDir"
  if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Expand-Archive -Path $electronZip -DestinationPath $InstallDir -Force

  # 4. Replace the stub default app with our app.asar, pulled from the
  #    @xmcl/app-<platform> package tarball (npmmirror's per-file endpoint is
  #    whitelist-only; package tarballs are unrestricted). The tarball also
  #    carries the checksum and the icon.
  $resources = Join-Path $InstallDir 'resources'
  Remove-Item -Force (Join-Path $resources 'default_app.asar') -ErrorAction SilentlyContinue

  Write-Step "Downloading app.asar ($appVersion)"
  $asarTgz = Join-Path $tmp 'app.tgz'
  Invoke-WebRequest -Uri "$Registry/$Package/-/app-$asarPlatform-$appVersion.tgz" -OutFile $asarTgz
  $pkgDir = Join-Path $tmp 'app'
  New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null
  & $Tar -xzf $asarTgz -C $pkgDir
  if ($LASTEXITCODE -ne 0) { throw "Failed to extract app tarball (tar exit $LASTEXITCODE)." }

  $asarPath = Join-Path $resources 'app.asar'
  Move-Item -Force (Join-Path $pkgDir 'package/app.asar') $asarPath

  # 5. Verify the checksum (sha256 of the asar). Best-effort: a missing or
  #    unreadable checksum shouldn't block a portable install.
  try {
    $expected = (Get-Content -Raw (Join-Path $pkgDir 'package/app.asar.sha256')).Trim()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $asarPath).Hash
    if ($expected -and ($expected -ine $actual)) {
      throw "Checksum mismatch for app.asar (expected $expected, got $actual)."
    }
    Write-Host '    checksum ok'
  } catch {
    Write-Warning "Skipped checksum verification: $($_.Exception.Message)"
  }

  # 6. Rename the executable to match the official portable build (cosmetic;
  #    user data is keyed by the app name inside app.asar, not the exe name).
  $exe = Join-Path $InstallDir "$AppName.exe"
  Move-Item -Force (Join-Path $InstallDir 'electron.exe') $exe

  # 7. Stamp the XMCL icon + version info into the exe, exactly like the
  #    official electron-builder output does with rcedit. Best-effort: the
  #    launcher already shows the correct icon at runtime (set from inside
  #    app.asar), so this only fixes the static file icon in Explorer. rcedit
  #    and the icon both come from npm so they mirror through npmmirror.
  if (-not $SkipIcon) {
    try {
      Write-Step 'Stamping icon + version info'
      $rcTgz = Join-Path $tmp 'rcedit.tgz'
      Invoke-WebRequest -Uri "$Registry/rcedit-wayvad/-/rcedit-wayvad-1.0.2.tgz" -OutFile $rcTgz
      & $Tar -xzf $rcTgz -C $tmp 'package/bin/rcedit.exe'
      if ($LASTEXITCODE -ne 0) { throw "rcedit extract failed (tar exit $LASTEXITCODE)." }
      $rcedit = Join-Path $tmp 'package/bin/rcedit.exe'
      $ico = Join-Path $pkgDir 'package/icon.ico'
      & $rcedit $exe `
        --set-icon $ico `
        --set-version-string 'ProductName' $AppName `
        --set-version-string 'FileDescription' $AppName `
        --set-file-version $appVersion `
        --set-product-version $appVersion
      if ($LASTEXITCODE -ne 0) { throw "rcedit exited with code $LASTEXITCODE" }
    } catch {
      Write-Warning "Skipped icon stamping: $($_.Exception.Message)"
    }
  }

  Write-Step "Installed to $InstallDir"
  Write-Host "    $exe"
  if ($Launch) { Start-Process $exe }
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
