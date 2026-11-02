import { basename, isAbsolute } from 'path'

export type AppImageUpdateMode = 'external' | 'self-managed'

/** No manager-detection contract exists. Only explicit ownership and a stable
 * filename opt into electron-updater, which otherwise renames versioned files.
 * Never rename files or rewrite third-party desktop/package-manager records.
 */
export function isExternallyUpdatedAppImage(
  env: string,
  mode: AppImageUpdateMode = 'external',
  appImagePath = process.env.APPIMAGE,
): boolean {
  return env === 'appimage' && (mode !== 'self-managed' || !appImagePath
    || !isAbsolute(appImagePath) || appImagePath.includes('\0') || /\d+\.\d+\.\d+/.test(basename(appImagePath)))
}

export function applyAutoUpdateSettings(
  updater: { autoDownload: boolean; autoInstallOnAppQuit: boolean; allowPrerelease: boolean },
  settings: { autoDownload: boolean; autoInstallOnAppQuit: boolean; allowPrerelease: boolean; appImageUpdateMode?: AppImageUpdateMode },
  env: string,
) {
  const external = isExternallyUpdatedAppImage(env, settings.appImageUpdateMode)
  updater.autoDownload = !external && settings.autoDownload
  updater.autoInstallOnAppQuit = !external && settings.autoInstallOnAppQuit
  updater.allowPrerelease = settings.allowPrerelease
}
