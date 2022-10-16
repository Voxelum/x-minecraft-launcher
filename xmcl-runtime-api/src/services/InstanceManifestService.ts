import { InstanceManifest } from '../entities/instanceManifest.schema'
import { ServiceKey } from './Service'

export interface GetManifestOptions {
  /**
   * The instance path
   *
   * If this does not present, it will be the current selected instance
   */
  path?: string
  /**
   * The hash to get for each instance files
   */
  hashes?: string[]
}

export interface InstanceManifestService {
  /**
   * Compute the instance manifest for current local files.
   */
  getInstanceManifest(options?: GetManifestOptions): Promise<InstanceManifest>
}

export const InstanceManifestServiceKey: ServiceKey<InstanceManifestService> = 'InstanceManifestService'
