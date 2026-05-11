import { BootstrapPreset } from '@xmcl/runtime-api'
import { InjectionKey, LauncherAppPlugin } from '~/app'

/**
 * Internal registry object that backs the renderer-facing
 * `BootstrapService`. Decoupled from the service implementation so the
 * service can be instantiated without any dependency the data root might
 * imply.
 *
 * - `getPreset` is registered by `pluginSetup` (it owns the disk worker).
 * - `acceptDataRoot` is registered by `LauncherApp.setup()` and resolves
 *   the boot promise.
 */
export interface Bootstrap {
  getPreset(): Promise<BootstrapPreset>
  acceptDataRoot(path: string): void
  /**
   * Wired by `pluginSetup` once the disk worker is ready.
   */
  setPresetProvider(provider: () => Promise<BootstrapPreset>): void
  /**
   * Wired by `LauncherApp.setup()` when waiting for the user-chosen data
   * root. Buffers any earlier `acceptDataRoot` call.
   */
  setAcceptor(acceptor: (path: string) => void): void
}

export const kBootstrap: InjectionKey<Bootstrap> = Symbol('Bootstrap')

class BootstrapImpl implements Bootstrap {
  #presetProvider: (() => Promise<BootstrapPreset>) | undefined
  #acceptor: ((path: string) => void) | undefined
  /**
   * Buffers a `chooseDataRoot` call that arrives before the acceptor has
   * been registered. In practice the renderer can only display the
   * bootstrap UI after `getPreset` resolves, and `getPreset` is registered
   * before the acceptor — but we keep the buffer to make the order
   * insensitive.
   */
  #pendingPath: string | undefined

  setPresetProvider(provider: () => Promise<BootstrapPreset>) {
    this.#presetProvider = provider
  }

  setAcceptor(acceptor: (path: string) => void) {
    this.#acceptor = acceptor
    if (this.#pendingPath !== undefined) {
      const p = this.#pendingPath
      this.#pendingPath = undefined
      acceptor(p)
    }
  }

  getPreset(): Promise<BootstrapPreset> {
    if (!this.#presetProvider) {
      throw new Error('Bootstrap preset provider not registered yet')
    }
    return this.#presetProvider()
  }

  acceptDataRoot(path: string) {
    if (this.#acceptor) {
      this.#acceptor(path)
    } else {
      this.#pendingPath = path
    }
  }
}

/**
 * Registers the bootstrap registry object early enough that the renderer
 * (which may already be open on the bootstrap screen) can call
 * `BootstrapService` immediately on connection.
 */
export const pluginBootstrap: LauncherAppPlugin = (app) => {
  app.registry.register(kBootstrap, new BootstrapImpl())
}
