import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { ensureDir, readFile, readlink, symlink, unlink, writeFile } from 'fs-extra'
import { dirname, join } from 'path'

async function writeMimeList(mimesAppsList: string) {
  if (!existsSync(mimesAppsList)) {
    await writeFile(mimesAppsList, ['[Default Applications]', 'x-scheme-handler/xmcl=xmcl.desktop;\n'].join('\n'))
    return
  }
  const content = await readFile(mimesAppsList, 'utf-8')
  if (content.indexOf('x-scheme-handler/xmcl=xmcl.desktop') === -1) {
    let lines = content.split('\n')
    const defaultAppsHeaderIndex = lines.indexOf('[Default Applications]')
    if (defaultAppsHeaderIndex === -1) {
      lines.push('[Default Applications]')
      lines.push('x-scheme-handler/xmcl=xmcl.desktop;')
    } else {
      lines = [...lines.slice(0, defaultAppsHeaderIndex + 1), 'x-scheme-handler/xmcl=xmcl.desktop;', ...lines.slice(defaultAppsHeaderIndex + 1)]
    }
    await writeFile(mimesAppsList, lines.join('\n'))
  }
}

/**
 * Ensures a stable symlink for AppImage that persists across updates
 * @param exePath The current executable path (not used for AppImage, but kept for consistency)
 * @param homePath The user's home directory
 * @returns The path to use in desktop file (either the symlink or original path)
 */
async function ensureAppImageSymlink(exePath: string, homePath: string): Promise<string> {
  // Only create symlink for AppImage
  // process.env.APPIMAGE contains the path to the actual AppImage file
  const appImagePath = process.env.APPIMAGE
  if (!appImagePath) {
    return exePath
  }

  const binDir = join(homePath, '.local', 'bin')
  const symlinkPath = join(binDir, 'xmcl')
  
  await ensureDir(binDir)

  // Check if symlink exists and points to correct location
  if (existsSync(symlinkPath)) {
    try {
      const currentTarget = await readlink(symlinkPath)
      if (currentTarget !== appImagePath) {
        // Update symlink to point to new version
        await unlink(symlinkPath)
        await symlink(appImagePath, symlinkPath)
      }
    } catch (e) {
      // If it's not a symlink or there's an error, remove and recreate
      await unlink(symlinkPath).catch(() => {})
      await symlink(appImagePath, symlinkPath)
    }
  } else {
    // Create new symlink
    await symlink(appImagePath, symlinkPath)
  }

  return symlinkPath
}

async function ensureDesktopFile(homePath: string, exePath: string, assigned: boolean) {
  const desktopFile = join(homePath, '.local', 'share', 'applications', 'xmcl.desktop')
  
  // For AppImage, use a stable symlink instead of the versioned path
  const execPath = await ensureAppImageSymlink(exePath, homePath)
  
  if (existsSync(desktopFile) || !assigned) {
    await ensureDir(dirname(desktopFile))
    await writeFile(desktopFile, `[Desktop Entry]\nName=X Minecraft Launcher\nExec=${execPath} %u\nIcon=${execPath}\nType=Application\nMimeType=x-scheme-handler/xmcl;`)
  }
}

export async function setLinuxProtocol(homePath: string, exePath: string) {
  const existed = execSync('xdg-settings get default-url-scheme-handler xmcl', { encoding: 'utf-8' }).trim()
  const assigned = existed.length > 0
  await ensureDesktopFile(homePath, exePath, assigned)

  if (!assigned) {
    const mimesAppsList = join(homePath, '.config', 'mimeapps.list')
    await writeMimeList(mimesAppsList)
      .catch(() => writeMimeList(join(homePath, '.local', 'share', 'applications', 'mimeapps.list')))
  }
}
