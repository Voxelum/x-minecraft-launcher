import LauncherApp from '../app/LauncherApp'

export abstract class Manager {
  constructor(protected app: LauncherApp) {
  }

  setup(): Promise<void> | void { }

  dispose(): Promise<void> | void { }
}
