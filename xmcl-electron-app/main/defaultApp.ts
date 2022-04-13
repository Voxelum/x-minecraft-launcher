import { InstalledAppManifest } from '@xmcl/runtime-api'
import iconPath from './assets/apple-touch-icon.png'
import winIcon from './assets/app.ico'
import defaultUrl from '/@renderer/index.html'
import { platform } from 'os'

const manifest: InstalledAppManifest = {
  name: 'KeyStone Launcher',
  description: 'The default launcher UI',
  url: defaultUrl,
  background_color: '0x424242',
  display: 'frameless',
  minWidth: 800,
  minHeight: 620,
  vibrancy: false,
  iconPath: platform() === 'win32' ? winIcon : iconPath,
  screenshots: [],
  icons: [],
  ratio: false,
}

export default manifest
