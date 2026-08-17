import { InstalledAppManifest } from '@xmcl/runtime-api'
import { LauncherApp } from '@xmcl/runtime/app'
import { LAUNCHER_NAME } from '@xmcl/runtime/constant'
import { join } from 'path'
import { BridgeServer } from '../bridge/BridgeServer'
import { ShellClient } from '../shell/ShellClient'
import { definedPlugins } from './definedPlugins'
import { TauriController } from './TauriController'
import { TauriHost } from './TauriHost'
import { TauriSecretStorage } from './TauriSecretStorage'
import { TauriShell } from './TauriShell'
import { TauriUpdater } from './TauriUpdater'

export interface TauriLauncherAppOptions {
  bridge: BridgeServer
  shell: ShellClient
  builtinAppManifest: InstalledAppManifest
  version: string
  /** `raw` or `appimage`, as the Electron target reports it. */
  env: string
  isDev: boolean
}

/**
 * `LauncherApp` hosted by the Tauri shell.
 *
 * Compared to `ElectronLauncherApp` this class is thin on purpose: that subclass
 * mostly existed to route `fetch` through Chromium's network stack and to
 * intercept the webview session. Here the sidecar is a plain Node process, so
 * the runtime's default `undici` fetch already is the real network stack, and
 * request interception lives in `RendererServer`.
 */
export class TauriLauncherApp extends LauncherApp {
  constructor(private readonly options: TauriLauncherAppOptions) {
    const host = new TauriHost(options.shell, options.version)
    super(
      host,
      new TauriShell(),
      new TauriSecretStorage(
        join(host.getPath('appData'), LAUNCHER_NAME, options.isDev ? 'secret-dev' : 'secret'),
      ),
      (app) => new TauriController(app, options.bridge, options.shell),
      (app) => new TauriUpdater(app),
      options.builtinAppManifest,
      options.env,
      definedPlugins,
    )
  }

  get isDev() {
    return this.options.isDev
  }

  relaunch(args?: string[]) {
    this.options.shell.relaunch(args)
  }
}
