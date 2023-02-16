import 'source-map-support/register'
import fs from 'fs'
import { gracefulify } from 'graceful-fs'
import ElectronLauncherApp from './ElectronLauncherApp'

gracefulify(fs)

new ElectronLauncherApp().start()
