// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import { app } from 'electron'
// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'

// Disable sandbox for AppImage to avoid chrome-sandbox permission issues
// AppImage mounts to /tmp which cannot have proper setuid permissions
if (process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox')
  // Disable /dev/shm usage to avoid permission issues on Linux
  // Some distros (e.g., Bazzite) have restrictive /dev/shm permissions that cause Chromium to crash
  // While AppImage is Linux-only today, we keep the platform check for defensive programming
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-dev-shm-usage')
  }
}

new ElectronLauncherApp().start()
