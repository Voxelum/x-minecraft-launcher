// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import { app } from 'electron'
// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'

// Disable sandbox for AppImage to avoid chrome-sandbox permission issues
// AppImage mounts to /tmp which cannot have proper setuid permissions
// Also disable /dev/shm usage to avoid shared memory permission issues
// See: https://github.com/Voxelum/x-minecraft-launcher/issues/1146
if (process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
}

new ElectronLauncherApp().start()
