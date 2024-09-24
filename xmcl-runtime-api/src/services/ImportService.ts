import { Resource, ResourceDomain } from '../entities/resource'
import { ServiceKey } from './Service'
export interface ImportModpackPolicy {
  /**
   * Should import this modpack to storage? (So you can use again in next time)
   * @default false
   */
  import?: boolean
  /**
   * Should apply this modpack setting to an instance?
   *
   * - If string, which should be a instance path, it will apply to the instance setting.
   */
  installToInstance?: string
}
export interface ImportSavePolicy {
  /**
   * Should save this world to the storage? (So you can re apply it to another instance again)
   * @default false
   */
  import?: boolean
  /**
   * Should install this save to an instance?
   *
   * - If string, which should be a instance path, it will apply to the instance setting.
   */
  installToInstance?: string
}
export interface ImportFileOptions {
  /**
   * Override the setting for importing modpack
   */
  modpackPolicy?: ImportModpackPolicy
  /**
   * Override the setting for importing save
   */
  savePolicy?: ImportSavePolicy
}

export interface ImportOptionsBase {
  /**
   * Override the setting for importing modpack
   */
  modpackPolicy?: ImportModpackPolicy
  /**
  * Override the setting for importing save
  */
  savePolicy?: ImportSavePolicy
  /**
  * Should install this mod/resource pack to an instance?
  *
  * - If string, which should be a instance path, it will apply to the instance setting.
  */
  installToInstance?: string
}

export interface ImportUrlOptions extends ImportOptionsBase {
  url: string

  domain?: ResourceDomain
}
/**
 * The universal import file service. Can import a modpack
 */
export interface ImportService {
  previewUrl(options: ImportUrlOptions): Promise<Resource | undefined>
}

export const ImportServiceKey: ServiceKey<ImportService> = 'ImportService'
