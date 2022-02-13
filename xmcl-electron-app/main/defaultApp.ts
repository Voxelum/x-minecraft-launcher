import { InstalledAppManifest } from '@xmcl/runtime-api'
import iconPath from './assets/apple-touch-icon.png'
import defaultUrl from '/@renderer/index.html'

const manifest: InstalledAppManifest = {
  name: 'KeyStone Launcher',
  description: 'The default launcher UI',
  url: defaultUrl,
  background_color: '0x424242',
  display: 'frameless',
  minWidth: 800,
  minHeight: 580,
  vibrancy: true,
  iconPath,
  screenshots: [],
  icons: [],
  ratio: false,
}

export default manifest
