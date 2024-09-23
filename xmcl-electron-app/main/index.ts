// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'

new ElectronLauncherApp().start()
