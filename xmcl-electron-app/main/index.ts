// eslint-disable-next-line @typescript-eslint/no-var-requires
require('graceful-fs').gracefulify(require('fs'))

// eslint-disable-next-line import/first
import ElectronLauncherApp from './ElectronLauncherApp'
// eslint-disable-next-line import/first
import { EventEmitter } from 'events'

EventEmitter.setMaxListeners(0)

new ElectronLauncherApp().start()
