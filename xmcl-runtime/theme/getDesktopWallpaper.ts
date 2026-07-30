import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolve the absolute path to the current OS desktop wallpaper image.
 *
 * Best-effort per platform:
 * - Windows: reads the `WallPaper` value from `HKCU\Control Panel\Desktop`.
 * - macOS: asks Finder for the current desktop picture.
 * - Linux (GNOME/GTK): reads `org.gnome.desktop.background picture-uri`.
 *
 * @returns The wallpaper file path, or undefined if it cannot be resolved.
 */
export async function getDesktopWallpaper(os: 'windows' | 'osx' | 'linux' | 'unknown'): Promise<string | undefined> {
  try {
    if (os === 'windows') {
      return await getWindowsWallpaper()
    }
    if (os === 'osx') {
      return await getMacWallpaper()
    }
    if (os === 'linux') {
      return await getLinuxWallpaper()
    }
  } catch {
    // ignore, return undefined below
  }
  return undefined
}

async function getWindowsWallpaper(): Promise<string | undefined> {
  const { stdout } = await execFileAsync('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WallPaper'], { windowsHide: true })
  // Output format:
  // HKEY_CURRENT_USER\Control Panel\Desktop
  //     WallPaper    REG_SZ    C:\path\to\wallpaper.jpg
  const match = stdout.match(/WallPaper\s+REG_SZ\s+(.+)/i)
  const path = match?.[1]?.trim()
  if (path && existsSync(path)) {
    return path
  }
  return undefined
}

async function getMacWallpaper(): Promise<string | undefined> {
  const { stdout } = await execFileAsync('osascript', ['-e', 'tell application "Finder" to get POSIX path of (get desktop picture as alias)'])
  const path = stdout.trim()
  if (path && existsSync(path)) {
    return path
  }
  return undefined
}

async function getLinuxWallpaper(): Promise<string | undefined> {
  const { stdout } = await execFileAsync('gsettings', ['get', 'org.gnome.desktop.background', 'picture-uri'])
  // Output looks like: 'file:///home/user/wallpaper.jpg'
  let value = stdout.trim()
  if ((value.startsWith('\'') && value.endsWith('\'')) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1)
  }
  const path = value.startsWith('file://') ? fileURLToPath(value) : value
  if (path && existsSync(path)) {
    return path
  }
  return undefined
}
