import {
  BootstrapPreset,
  BootstrapService as IBootstrapService,
  BootstrapServiceKey,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { LauncherApp } from '~/app/LauncherApp'
import { AbstractService, ExposeServiceKey } from '~/service'
import { Bootstrap, kBootstrap } from './bootstrap'

/**
 * Renderer-facing service for the first-run setup screen.
 *
 * Intentionally has **no injected dependencies** other than the
 * `LauncherApp`, so it can be answered before the data root exists. All
 * actual work is delegated to the `Bootstrap` registry object that
 * `pluginBootstrap` + `pluginSetup` + `LauncherApp.setup()` populate.
 */
@ExposeServiceKey(BootstrapServiceKey)
export class BootstrapService extends AbstractService implements IBootstrapService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app)
  }

  async #get(): Promise<Bootstrap> {
    return this.app.registry.get(kBootstrap)
  }

  async getPreset(): Promise<BootstrapPreset> {
    const b = await this.#get()
    return b.getPreset()
  }

  async chooseDataRoot(path: string): Promise<void> {
    const b = await this.#get()
    b.acceptDataRoot(path)
  }
}
