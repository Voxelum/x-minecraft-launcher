import { ServiceKey } from './Service'

export interface XaeroMapsService {
  /**
   * Setup shared Xaero maps for an instance
   * @param instancePath The path to the instance
   */
  setupSharedMaps(instancePath: string): Promise<void>

  /**
   * Remove shared Xaero maps links for an instance
   * @param instancePath The path to the instance
   */
  removeSharedMaps(instancePath: string): Promise<void>

  /**
   * Get the shared maps directory path
   */
  getSharedMapsPath(): string

  /**
   * Check if an instance has shared maps enabled
   * @param instancePath The path to the instance
   */
  isSharedMapsEnabled(instancePath: string): Promise<boolean>

  /**
   * Migrate existing maps to shared location
   * @param instancePath The path to the instance
   */
  migrateToSharedMaps(instancePath: string): Promise<void>

  /**
   * Setup server-specific shared maps based on server matching
   * @param instancePath The path to the instance
   */
  setupServerSpecificMaps(instancePath: string): Promise<void>
}

export const XaeroMapsServiceKey: ServiceKey<XaeroMapsService> = 'XaeroMapsService'