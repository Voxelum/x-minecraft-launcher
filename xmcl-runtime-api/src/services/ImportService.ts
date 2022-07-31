import { Resource, ResourceDomain } from '../entities/resource'
import { ImportResourceOptions as _ImportFileOptions, PartialResourcePath } from './ResourceService'
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
   * - If `true`, it will create a new instance with this modpack setting.
   * - If string, which should be a instance path, it will apply to the instance setting.
   * @default true
   */
  installToInstance?: boolean
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
   * - If `true`, it will apply to current selected instance.
   * - If string, which should be a instance path, it will apply to the instance setting.
   * @default true
   */
  installToInstance?: string | boolean
}
export interface ImportFileOptions {
  resource: PartialResourcePath
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
   * - If `true`, it will apply to current selected instance.
   * - If string, which should be a instance path, it will apply to the instance setting.
   * @default true
   */
  installToInstance?: string | boolean
  /**
   * Is import file task in background?
   */
  background?: boolean
  /**
    * If optional, the resource won't be import if we cannot parse it.
    */
  optional?: boolean
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
  * - If `true`, it will apply to current selected instance.
  * - If string, which should be a instance path, it will apply to the instance setting.
  * @default true
  */
  installToInstance?: string | boolean
}

export interface ImportUrlOptions extends ImportOptionsBase {
  url: string

  domain?: ResourceDomain
}
/**
 * The universal import file service. Can import a modpack
 */
export interface ImportService {
  /**
   * Import any file to the launcher.
   * If the target file is directory, and the `import` option is true, it will pack it into zip and import.
   *
   * - For resource packs, it method will import and save them whatever by default.
   * - For mods, you cannot import directory as we won't pack the jar correctly...
   * - For save, you can override the setting in `savePolicy`
   * - For modpack, you can override the setting in `modpackPolicy`
   */
  importFile(options: ImportFileOptions): Promise<void>

  previewUrl(options: ImportUrlOptions): Promise<Resource | undefined>
}

export const ImportServiceKey: ServiceKey<ImportService> = 'ImportService'
