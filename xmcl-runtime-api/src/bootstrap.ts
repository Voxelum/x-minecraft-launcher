import { ServiceKey } from './services/Service'

export interface Drive {
  filesystem: string
  blocks: number
  used: number
  available: number
  /**
   * Disk usage percentage as reported by `df` (e.g. `"83%"`). Comes
   * straight from `node-disk-info`, which exposes it as a string.
   */
  capacity: string
  mounted: string

  selectedPath: string
}

export interface BootstrapPreset {
  minecraftPath: string
  defaultPath: string
  locale: string
  drives: Drive[]
}

/**
 * The first-run setup service. Available **before** the launcher data root
 * is chosen — i.e. before any other service is fully wired up.
 *
 * It is registered through the standard `serviceChannels` dispatcher, but
 * its implementation is intentionally dependency-free so it can answer
 * `getPreset()` immediately and accept the user's chosen data root via
 * `chooseDataRoot()` to unblock boot.
 */
export interface BootstrapService {
  /**
   * Returns the OS-suggested defaults to seed the bootstrap UI.
   */
  getPreset(): Promise<BootstrapPreset>
  /**
   * Tell the launcher which directory to use as the data root. This
   * resolves the boot promise and lets `LauncherApp.setup()` continue.
   */
  chooseDataRoot(path: string): Promise<void>
}

export const BootstrapServiceKey: ServiceKey<BootstrapService> = 'BootstrapService'
