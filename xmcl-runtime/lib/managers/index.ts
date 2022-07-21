import LauncherApp from '../app/LauncherApp'

export abstract class Manager {
  constructor(protected app: LauncherApp) { }

  private name: string = Object.getPrototypeOf(this).constructor.name

  setup(): Promise<void> | void { }

  dispose(): Promise<void> | void { }

  log(m: any, ...args: any[]) { this.app.logManager.log(`[${this.name}] ${m}`, ...args) }

  warn(m: any, ...args: any[]) { this.app.logManager.warn(`[${this.name}] ${m}`, ...args) }

  error(m: any, ...args: any[]) { this.app.logManager.error(`[${this.name}] ${m}`, ...args) }
}
