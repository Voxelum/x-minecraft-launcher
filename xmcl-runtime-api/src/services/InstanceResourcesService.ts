import type { ResourceState } from '@xmcl/resource'
import { Exception, ExceptionBase } from '../entities/exception'
import { InstallMarketOptionWithInstance } from '../entities/market'
import { SharedState } from '../util/SharedState'

export interface UpdateInstanceResourcesOptions {
  /**
   * The resource files
   */
  files: string[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path: string
}
/**
 * Provide the abilities to install resources files to instance
 */
export interface InstanceResourcesService {
  /**
   * Watch the `resourcepacks` directory under the instance path and import the resources file.
   * @param instancePath The instance path
   */
  watch(instancePath: string): Promise<SharedState<ResourceState>>
  /**
   * Manually install the resources to the instance.
   *
   * Only call this if you don't want to use link or link is failed.
   */
  install(options: UpdateInstanceResourcesOptions): Promise<string[]>
  /**
   * Uninstall the resourcepack file from the instance.
   */
  uninstall(options: UpdateInstanceResourcesOptions): Promise<void>
  /**
   * Install resources from the market to the instance.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]>
  /**
   * Show the `resourcepacks` directory under the instance path
   * @param instancePath The instance path
   */
  showDirectory(instancePath: string): Promise<void>
  /**
   * Refresh the metadata of the instance resources
   */
  refreshMetadata(instancePath: string): Promise<void>
}

/**
 * Raised when a resource file (mod/resourcepack/shaderpack/…) cannot be
 * parsed by `@xmcl/resource`. Carries the on-disk `path` so the UI can
 * tell the user *which* file is broken, and a `code` identifying the
 * underlying parser failure (e.g. `InvalidZipFileError`,
 * `MultiDiskZipFileError`, `PermissionError`).
 *
 * This is intentionally an `Exception` (not an `Error`) so the runtime
 * telemetry sink skips it — see knowledge/runbooks/telemetry-triage.md
 * for the `Exception` vs `Error` doctrine. A broken jar in the user's
 * mods folder is environment state, not a launcher defect.
 */
export interface ParseResourceException extends ExceptionBase {
  type: 'parseResourceException'
  code: string
  path: string
}

export type ParseExceptions = ParseResourceException

export class ParseException extends Exception<ParseExceptions> { }

