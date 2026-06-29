// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import { app } from 'electron'
// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'

// AppImage mounts its read-only squashfs to a temporary location, so the bundled
// chrome-sandbox helper can never gain the SUID bit and the namespace sandbox
// fails creating shared memory in /dev/shm (ESRCH). Both make the launcher crash
// on start unless the sandbox is disabled. See issue #1522.
if (process.env.APPIMAGE) {
  app.commandLine.appendSwitch('no-sandbox')
  // The bundled SUID helper can't be configured correctly on read-only squashfs,
  // so skip it explicitly to avoid the misleading SUID fallback fatal error.
  app.commandLine.appendSwitch('disable-setuid-sandbox')
}

new ElectronLauncherApp().start()
