import { Exception } from '../entities/exception'
import { ServiceKey } from './Service'

export interface InstanceVersionService {
}

export const InstanceVersionServiceKey: ServiceKey<InstanceVersionService> = 'InstanceVersionService'

export type InstanceVersionExceptions = {
  /**
   * - fixVersionNoVersionMetadata -> no minecraft version metadata.
   * - fixVersionNoForgeVersionMetadata -> no forge version metadata.
   */
  type: 'fixVersionNoVersionMetadata' | 'fixVersionNoForgeVersionMetadata'
  minecraft: string
  forge?: string
}

export class InstanceVersionException extends Exception<InstanceVersionExceptions> { }
