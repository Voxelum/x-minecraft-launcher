import { spawn } from 'child_process'
import { constants, openSync } from 'fs'
import { access } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * What the updater should do after a package was installed in place: `quit` lets a helper
 * finish the swap and relaunch; `relaunch` restarts into the already-installed version.
 * `undefined` means in-place install is not possible here, so the package is opened instead.
 */
export type InPlaceInstall = 'quit' | 'relaunch' | undefined

export interface InstallerHost {
  platform: string
  /** Only packaged builds are replaced; a development Electron must never be swapped. */
  packaged: boolean
  execPath: string
  pid: number
  logPath: string
  spawn: typeof spawn
  writable: (path: string) => Promise<boolean>
  executable: (path: string) => Promise<boolean>
}

/** The `.app` bundle that contains this executable, e.g. `/Applications/Vardrynn.app`. */
export function macAppBundle(execPath: string): string | undefined {
  const match = /^(.+?\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath)
  return match?.[1]
}

/**
 * Waits for the launcher to exit, copies the `.app` from the verified dmg next to the current
 * bundle, then swaps them. The bundle identifier must match. Any failure restores the old
 * bundle. Either way the launcher is reopened, so a failed update never leaves the user without one.
 * Arguments: pid dmg bundle.
 */
export const MAC_SWAP_SCRIPT = `set -u
pid=$1 dmg=$2 bundle=$3
new="$bundle.vardrynn-new"; old="$bundle.vardrynn-old"; mnt=""
cleanup() { [ -n "$mnt" ] && { hdiutil detach "$mnt" -quiet -force 2>/dev/null; rmdir "$mnt" 2>/dev/null; }; mnt=""; }
fail() {
  echo "vardrynn update failed: $1"
  cleanup; rm -rf "$new"
  if [ ! -d "$bundle" ] && [ -d "$old" ]; then mv "$old" "$bundle"; fi
  open "$bundle"; exit 1
}
echo "vardrynn update: waiting for $pid"
while kill -0 "$pid" 2>/dev/null; do sleep 0.5; done
rm -rf "$new" "$old"
mnt=$(mktemp -d "\${TMPDIR:-/tmp}/vardrynn-update.XXXXXX") || fail mktemp
hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$mnt" "$dmg" >/dev/null || fail attach
src=$(find "$mnt" -maxdepth 1 -name '*.app' -type d | head -n 1)
[ -n "$src" ] || fail "no app in package"
want=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$bundle/Contents/Info.plist") || fail "read current id"
got=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$src/Contents/Info.plist") || fail "read new id"
[ "$want" = "$got" ] || fail "bundle id $got does not match $want"
ditto "$src" "$new" || fail copy
cleanup
mv "$bundle" "$old" || fail "move current aside"
mv "$new" "$bundle" || fail "move new into place"
rm -rf "$old"
echo "vardrynn update: installed"
open "$bundle"
`

async function installMac(host: InstallerHost, dmg: string): Promise<InPlaceInstall> {
  if (!dmg.endsWith('.dmg')) return undefined
  const bundle = macAppBundle(host.execPath)
  // A translocated or read-only copy (for example still on the dmg) cannot be replaced.
  if (!bundle || bundle.includes('/AppTranslocation/') || !(await host.writable(dirname(bundle))) || !(await host.writable(bundle))) {
    return undefined
  }
  const log = openSync(host.logPath, 'a')
  const child = host.spawn('/bin/sh', ['-c', MAC_SWAP_SCRIPT, 'vardrynn-update', String(host.pid), dmg, bundle], {
    detached: true,
    stdio: ['ignore', log, log],
  })
  child.unref()
  return 'quit'
}

/** pkexec shows the system's password prompt; dpkg keeps the old version if the install fails. */
async function installDeb(host: InstallerHost, deb: string): Promise<InPlaceInstall> {
  if (!deb.endsWith('.deb') || !(await host.executable('/usr/bin/pkexec'))) return undefined
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = host.spawn('/usr/bin/pkexec', ['/usr/bin/dpkg', '-i', deb], { stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', resolve)
  })
  // 126: the user dismissed the prompt; 127: not authorized.
  if (code === 126 || code === 127) throw new Error('Installation was not authorized')
  if (code !== 0) throw new Error(`The package installer exited with code ${code}`)
  return 'relaunch'
}

export async function installInPlace(host: InstallerHost, path: string): Promise<InPlaceInstall> {
  if (!host.packaged) return undefined
  if (host.platform === 'darwin') return installMac(host, path)
  if (host.platform === 'linux') return installDeb(host, path)
  return undefined
}

export function defaultInstallerHost(packaged: boolean, logDirectory: string): InstallerHost {
  return {
    platform: process.platform,
    packaged,
    execPath: process.execPath,
    pid: process.pid,
    logPath: join(logDirectory, 'update-install.log'),
    spawn,
    writable: (path) => access(path, constants.W_OK).then(() => true, () => false),
    executable: (path) => access(path, constants.X_OK).then(() => true, () => false),
  }
}
