import { InstalledAppManifest } from '@xmcl/runtime-api'
import { platform } from 'os'
import { darkIco, darkIcon, darkTray, lightIco, lightIcon, lightTray } from '../../../xmcl-electron-app/main/utils/icons'

/**
 * The builtin app manifest, same content as the Electron target's except for the
 * URL: there is no custom `xmcl.runtime` scheme here, the renderer is served by
 * `RendererServer` over loopback, so the origin is only known at runtime.
 */
export function createDefaultApp(url: string): InstalledAppManifest {
  const icons = {
    icon: platform() === 'win32' ? lightIco : lightIcon,
    darkIcon: platform() === 'win32' ? darkIco : darkIcon,
    trayIcon: lightTray,
    darkTrayIcon: darkTray,
    dockIcon: lightIcon,
    darkDockIcon: darkIcon,
  }
  return {
    name: 'KeyStone Launcher',
    description: 'The default launcher UI',
    url,
    backgroundColor: '0x424242',
    minWidth: 800,
    minHeight: 400,
    vibrancy: false,
    iconSets: icons,
    screenshots: [],
    ratio: false,
    iconUrls: icons,
    defaultWidth: 1200,
    defaultHeight: 720,
  }
}
