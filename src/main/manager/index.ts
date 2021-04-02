import LauncherApp from '/@main/app/LauncherApp'
import { StaticStore } from '../util/staticStore'

export abstract class Manager {
  constructor(protected app: LauncherApp) { }

  private name: string = Object.getPrototypeOf(this).constructor.name

  /* eslint-disable */
  setup(): Promise<void> | void { }

  rootReady(root: string): Promise<void> | void { }

  engineReady(): Promise<void> | void { }

  storeReady(store: StaticStore<any>): Promise<void> | void { }
  /* eslint-enable */

  beforeQuit(): Promise<void> | void { }

  log(m: any, ...args: any[]) { this.app.logManager.log(`[${this.name}] ${m}`, ...args) }

  warn(m: any, ...args: any[]) { this.app.logManager.warn(`[${this.name}] ${m}`, ...args) }

  error(m: any, ...args: any[]) { this.app.logManager.error(`[${this.name}] ${m}`, ...args) }
}
