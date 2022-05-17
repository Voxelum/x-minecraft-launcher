import defaultUrl from '@renderer/index.html'
import { InstalledAppManifest } from '@xmcl/runtime-api'
import { platform } from 'os'
import { darkIco, darkIcon, darkTray, lightIco, lightIcon, lightTray } from './utils/icons'

const manifest: InstalledAppManifest = {
  name: 'KeyStone Launcher',
  description: 'The default launcher UI',
  url: defaultUrl,
  background_color: '0x424242',
  display: 'frameless',
  minWidth: 800,
  minHeight: 620,
  vibrancy: false,
  iconSets: {
    icon: platform() === 'win32' ? lightIco : lightIcon,
    darkIcon: platform() === 'win32' ? darkIco : darkIcon,

    trayIcon: lightTray,
    darkTrayIcon: darkTray,

    dockIcon: lightIcon,
    darkDockIcon: darkIcon,
  },
  screenshots: [],
  icons: [],
  ratio: false,
}

export default manifest
