#!/bin/sh
# Portable installer for X Minecraft Launcher (XMCL) — macOS & Linux.
#
# Reconstructs a runnable launcher — equivalent to extracting the official
# tar.xz (Linux) or the dmg's .app (macOS) — by downloading the matching
# Electron prebuilt from the npmmirror Electron mirror and the app.asar from the
# per-platform @xmcl/app-<platform> npm package. Intended for users behind the
# GFW who have not installed XMCL yet.
#
# Usage:
#   curl -fsSL https://xmcl.app/install.sh | sh
#   curl -fsSL https://xmcl.app/install.sh | sh -s -- --launch
#   ./install.sh --install-dir ~/Apps --version 0.56.6 --launch
#
# Env overrides: XMCL_REGISTRY, XMCL_ELECTRON_MIRROR, XMCL_INSTALL_DIR.
set -eu

REGISTRY="${XMCL_REGISTRY:-https://registry.npmmirror.com}"
ELECTRON_MIRROR="${XMCL_ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron}"
APP_NAME="X Minecraft Launcher"

VERSION="latest"
INSTALL_DIR="${XMCL_INSTALL_DIR:-}"
LAUNCH=0
SKIP_ICON=0

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --launch) LAUNCH=1; shift ;;
    --skip-icon) SKIP_ICON=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
die()  { printf 'error: %s\n' "$1" >&2; exit 1; }

# --- prerequisites -----------------------------------------------------------
if command -v curl >/dev/null 2>&1; then
  fetch()    { curl -fsSL "$1"; }
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch()    { wget -qO- "$1"; }
  download() { wget -qO "$2" "$1"; }
else
  die "need curl or wget"
fi

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum   >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# --- resolve platform / arch -------------------------------------------------
os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
  Darwin) el_os="darwin"; plat_base="mac" ;;
  Linux)  el_os="linux";  plat_base="linux" ;;
  *) die "unsupported OS: $os" ;;
esac

case "$arch" in
  x86_64|amd64)  el_arch="x64";   plat_suffix="" ;;
  arm64|aarch64) el_arch="arm64"; plat_suffix="-arm64" ;;
  *) die "unsupported arch: $arch" ;;
esac

platform="${plat_base}${plat_suffix}"   # mac | mac-arm64 | linux | linux-arm64
pkg="@xmcl/app-${platform}"

if [ -z "$INSTALL_DIR" ]; then
  if [ "$os" = "Darwin" ]; then INSTALL_DIR="$HOME/Applications"; else INSTALL_DIR="$HOME/.local/share/xmcl"; fi
fi

# --- resolve version + electron from npm metadata ----------------------------
step "Resolving $pkg@$VERSION"
meta="$(fetch "$REGISTRY/$pkg/$VERSION")" || die "cannot reach $REGISTRY"
app_version="$(printf '%s' "$meta" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
electron="$(printf '%s' "$meta"    | grep -o '"electron":"[^"]*"' | head -1 | cut -d'"' -f4)"
[ -n "$app_version" ] || die "could not read version from $pkg metadata"
[ -n "$electron" ]    || die "$pkg@$app_version has no 'electron' field"
printf '    app=%s electron=%s arch=%s\n' "$app_version" "$electron" "$el_arch"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

# --- download Electron prebuilt + app tarball --------------------------------
step "Downloading Electron $electron"
download "$ELECTRON_MIRROR/$electron/electron-v$electron-$el_os-$el_arch.zip" "$tmp/electron.zip"

step "Downloading app.asar ($app_version)"
download "$REGISTRY/$pkg/-/app-$platform-$app_version.tgz" "$tmp/app.tgz"
mkdir -p "$tmp/app"
tar -xzf "$tmp/app.tgz" -C "$tmp/app"   # -> $tmp/app/package/{app.asar,app.asar.sha256,icon.icns}
asar_src="$tmp/app/package/app.asar"
[ -f "$asar_src" ] || die "app.asar missing from $pkg tarball"

# --- verify checksum (before placing it) -------------------------------------
if [ -f "$tmp/app/package/app.asar.sha256" ]; then
  expected="$(cut -d' ' -f1 <"$tmp/app/package/app.asar.sha256" | tr -d '[:space:]')"
  actual="$(sha256_of "$asar_src")"
  if [ -n "$actual" ] && [ -n "$expected" ] && [ "$expected" != "$actual" ]; then
    die "checksum mismatch for app.asar (expected $expected, got $actual)"
  fi
  [ -n "$actual" ] && echo "    checksum ok"
fi

# --- assemble --------------------------------------------------------------
if [ "$os" = "Darwin" ]; then
  step "Building $APP_NAME.app in $INSTALL_DIR"
  mkdir -p "$tmp/ex" "$INSTALL_DIR"
  ditto -x -k "$tmp/electron.zip" "$tmp/ex"
  app="$INSTALL_DIR/$APP_NAME.app"
  rm -rf "$app"
  mv "$tmp/ex/Electron.app" "$app"

  contents="$app/Contents"
  rm -f "$contents/Resources/default_app.asar"
  mv "$asar_src" "$contents/Resources/app.asar"

  # Rename the main executable and point the bundle at it + our identity, so
  # the reconstructed app matches the official dmg (same name, icon, identifier
  # => same userData, zero migration).
  if [ -f "$contents/MacOS/Electron" ]; then
    mv "$contents/MacOS/Electron" "$contents/MacOS/$APP_NAME"
  fi
  plist="$contents/Info.plist"
  pb() { /usr/libexec/PlistBuddy -c "$1" "$plist" >/dev/null 2>&1 || true; }
  pb "Set :CFBundleExecutable $APP_NAME"
  pb "Set :CFBundleName $APP_NAME"
  pb "Set :CFBundleIdentifier xmcl"
  # CFBundleDisplayName may be absent in Electron's plist, so add it if Set fails.
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$plist" >/dev/null 2>&1 \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string $APP_NAME" "$plist" >/dev/null 2>&1 || true

  if [ "$SKIP_ICON" != "1" ] && [ -f "$tmp/app/package/icon.icns" ]; then
    # Electron's default bundle icon is electron.icns; overwrite in place so
    # Info.plist's CFBundleIconFile keeps pointing at it.
    cp "$tmp/app/package/icon.icns" "$contents/Resources/electron.icns"
  fi

  # Ad-hoc re-sign: modifying the bundle invalidates Electron's signature, and
  # Apple Silicon refuses to run an app with a broken/absent signature.
  if command -v codesign >/dev/null 2>&1; then
    step "Ad-hoc signing"
    codesign --force --deep --sign - "$app" >/dev/null 2>&1 || echo "    warn: codesign failed; app may be blocked on Apple Silicon"
  fi

  step "Installed to $app"
  [ "$LAUNCH" = "1" ] && open "$app"
else
  command -v unzip >/dev/null 2>&1 || die "need unzip"
  step "Extracting to $INSTALL_DIR"
  rm -rf "$INSTALL_DIR"; mkdir -p "$INSTALL_DIR"
  unzip -q "$tmp/electron.zip" -d "$INSTALL_DIR"

  rm -f "$INSTALL_DIR/resources/default_app.asar"
  mv "$asar_src" "$INSTALL_DIR/resources/app.asar"

  mv "$INSTALL_DIR/electron" "$INSTALL_DIR/xmcl"
  chmod +x "$INSTALL_DIR/xmcl"

  # chrome-sandbox must be root-owned + setuid, which needs privileges we may
  # not have in a portable install. Best-effort; otherwise --no-sandbox works.
  if [ -f "$INSTALL_DIR/chrome-sandbox" ]; then
    if [ "$(id -u)" = "0" ]; then
      chown root:root "$INSTALL_DIR/chrome-sandbox" 2>/dev/null || true
      chmod 4755 "$INSTALL_DIR/chrome-sandbox" 2>/dev/null || true
    fi
  fi

  step "Installed to $INSTALL_DIR/xmcl"
  echo "    if it fails with a sandbox error, run: $INSTALL_DIR/xmcl --no-sandbox"
  [ "$LAUNCH" = "1" ] && "$INSTALL_DIR/xmcl" >/dev/null 2>&1 &
fi
