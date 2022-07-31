import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Logger } from '../util/log'

export abstract class Manager {
  constructor(protected app: LauncherApp) {
  }

  setup(): Promise<void> | void { }

  dispose(): Promise<void> | void { }
}
