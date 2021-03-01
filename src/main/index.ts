// export { Manager } from './manager'
// export { BuiltinServices } from './service'
// export { StaticStore } from '../shared/util/staticStore'
// // export { LauncherAppController, AppContext } from './app/LauncherAppController';

// eslint-disable-next-line import/first
import ElectronLauncherApp from './electron/ElectronLauncherApp'

new ElectronLauncherApp().start()
