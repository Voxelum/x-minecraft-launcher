import { Exception, InstanceNotFoundException } from '../entities/exception'
import { InstanceSave, InstanceSaveHeader, Saves } from '../entities/save'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

export interface ExportSaveOptions {
  /**
   * The instance directory path, e.g. the path of .minecraft folder.
   *
   * This will be the active instance by default.
   */
  instancePath: string
  /**
   * The save folder name to export.
   */
  saveName: string
  /**
   * The destination full file path.
   */
  destination: string
  /**
   * Should export as zip
   * @default true
   */
  zip?: boolean
}
export interface ImportSaveOptions {
  /**
   * the save zip file or directory path
   */
  path: string
  /**
  * The destination instance directory path, e.g. the path of .minecraft folder.
  *
  * This will be the active instance by default.
  */
  instancePath: string
  /**
   * The root of the save in zip
   */
  saveRoot?: string
  /**
   * Linked curseforge
   */
  curseforge?: {
    projectId: number
    fileId: number
  }
  /**
   * The destination save folder name will be imported into.
   *
   * It will be the basename of the source file path if this is not present.
   */
  saveName?: string
}

export interface DeleteSaveOptions {
  /**
   * The save name will be deleted
   */
  saveName: string
  /**
   * The instance path of this save. If this is not presented, it will delete shared save.
   */
  instancePath?: string
}

export interface ShareSaveOptions {
  saveName: string
  instancePath: string
}
export interface CloneSaveOptions {
  /**
   * The source instance path. If it is not presented, it will use selected instance.
   */
  srcInstancePath: string
  /**
   * The destination instance path. If it is not presented, it will use selected instance.
   */
  destInstancePath: string | string[]
  /**
   * The save name to clone
   */
  saveName: string
  /**
   * The new save name.
   * @default Generated name from the `saveName`
   */
  newSaveName?: string
}

export function getInstanceSaveKey(path: string) {
  return `instance-saves://${path}`
}

export interface LinkSaveAsServerWorldOptions {
  /**
   * The instance path
   */
  instancePath: string
  /**
   * The save name
   */
  saveName: string
}

/**
 * Provide the ability to preview saves data of an instance
 */
export interface InstanceSavesService {
  showDirectory(instancePath: string): Promise<void>
  /**
   * Read all saves under the instance folder
   * @param path The instance folder path
   */
  getInstanceSaves(path: string): Promise<InstanceSaveHeader[]>
  /**
   * Watch instances saves
   * @param path
   */
  watch(path: string): Promise<MutableState<Saves>>
  /**
   * Clone a save under an instance to one or multiple instances.
   *
   * @param options
   */
  cloneSave(options: CloneSaveOptions): Promise<void>

  shareSave(options: ShareSaveOptions): Promise<void>
  /**
   * Delete a save in a specific instance.
   */
  deleteSave(options: DeleteSaveOptions): Promise<void>
  /**
   * Import a zip or folder save to the target instance.
   *
   * If the instancePath is not presented in the options, it will use the current selected instancePath.
   *
   * @returns The imported save path
   */
  importSave(options: ImportSaveOptions): Promise<string>
  /**
   * Export a save from a managed instance to an external location.
   *
   * You can choose export the save to zip or a folder.
   */
  exportSave(options: ExportSaveOptions): Promise<void>
  /**
   * Link saves folder to shared-saves.
   *
   * If the saves exists, it will move all saves to shared-saves and link the saves folder to shared-saves.
   */
  linkSharedSave(instancePath: string): Promise<void>

  isSaveLinked(instancePath: string): Promise<boolean>
  /**
   * Unlink saves folder from shared-saves.
   */
  unlinkSharedSave(instancePath: string): Promise<void>
  /**
   * Get the shared saves. The saves `instanceName` will be an empty string.
   */
  getSharedSaves(): Promise<InstanceSave[]>

  linkSaveAsServerWorld(options: LinkSaveAsServerWorldOptions): Promise<void>

  /**
   * Get the linked save world path.
   * @param instancePath
   * @return The linked save world path. Should if it's a origial world folder them it's unlinked folder existed. `undefined` if no folder existed.
   */
  getLinkedSaveWorld(instancePath: string): Promise<string | undefined>
}

export const InstanceSavesServiceKey: ServiceKey<InstanceSavesService> = 'InstanceSavesService'

export type InstanceSaveExceptions = {
  /**
   * - instanceDeleteNoSave -> no save match name provided
   */
  type: 'instanceDeleteNoSave'
  /**
    * The save name
    */
  name: string
} | {
  type: 'instanceImportIllegalSave'
  path: string
} | {
  type: 'instanceCopySaveNotFound' | 'instanceCopySaveUnexpected'
  src: string
  dest: string[]
} | InstanceNotFoundException

export class InstanceSaveException extends Exception<InstanceSaveExceptions> { }
