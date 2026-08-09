import type { InstanceData, InstanceFile, ModpackInstallProfile, PartialRuntimeVersions, RuntimeVersions } from '@xmcl/instance'
import type { ResourceMetadata, ResourceState } from '@xmcl/resource'
import { Exception } from '../entities/exception'
import type { InstallMarketOptions } from '../entities/market'
import type { SharedState } from '../util/SharedState'
import type { CreateInstanceOption } from './InstanceService'
import type { ServiceKey } from './Service'
import type { Task, SubState } from '../task'
import type { WithProgress } from '@xmcl/installer'
import type { CreateModrinthProjectData, CreateModrinthVersionData, Project, UpdateModrinthProjectData } from '@xmcl/modrinth'

export interface ExportModpackTrackerEvents {
  'zip.progress': WithProgress<{ destination: string }>
}

export interface ExportModpackTask extends Task {
  type: 'exportModpack'
  instancePath: string
  name: string
  substate: SubState<ExportModpackTrackerEvents, 'zip.progress'>
}

export interface ExportFileDirective {
  path: string
  /** Source path relative to the instance. Defaults to `path`. */
  source?: string
  /**
   * Force this file included as override. Otherwise, it will use `downloads` in modrinth modpack and curseforge id in curseforge modpack
   *
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#server-overrides
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#client-overrides
   */
  override?: boolean
  /**
   * The env info for modrinth modpack.
   */
  env?: {
    client?: 'required' | 'unsupported' | 'optional'
    server?: 'required' | 'unsupported' | 'optional'
  }
}
export interface ExportModpackOptions {
  /**
   * The name of the modpack.
   */
  name: string
  /**
   * The version of the modpack.
   */
  version: string
  /**
   * The author of the modpack.
   */
  author: string
  /**
   * The game version id of the modpack. You can use the `id` in `LocalVersionHeader`.
   */
  gameVersion: string
  /**
   * A list of files that want to export (curseforge or modrinth)
   */
  files: ExportFileDirective[]
  /**
   * The instance path to be exported
   */
  instancePath: string
  /**
  * The dest path of the exported instance
  */
  destinationDirectory: string
  /**
   * Only available for mcbbs modpack
   */
  fileApi?: string
  /**
   * Emit the curseforge format modpack
   */
  emitCurseforge?: boolean
  /**
   * Emit the mcbbs format modpack
   */
  emitMcbbs?: boolean
  /**
   * Emit the modrinth modpack (mrpack).
   */
  emitModrinth?: boolean
  /**
   * Emit the offline zip modpack.
   */
  emitOffline?: boolean
  /**
   * Modrinth only. This will limit the download urls from allowed domains listed in modrinth document.
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#downloads
   */
  strictModeInModrinth?: boolean
  /** Do not reveal the artifact in the system file manager. */
  showInFolder?: boolean
}

export interface ExportModpackResult {
  curseforge?: string
  curseforgeServer?: string
  modrinth?: string
  offline?: string
}

export interface ModrinthLinkagePreviewEntry {
  /** The instance-relative path of the file, e.g. `mods/sodium.jar`. */
  path: string
  /** Whether this file can be represented by a Modrinth download link instead of being embedded. */
  linked: boolean
  /** Present when `linked` is false, explaining why the file must be embedded. */
  reason?: 'missing-file' | 'not-linked-to-modrinth' | 'no-downloadable-url'
}

export interface ModrinthLinkagePreview {
  /** Total number of mods/resourcepacks/shaderpacks considered (excludes forced overrides and other files). */
  total: number
  /** Number of files that will be referenced by a Modrinth download link. */
  linked: number
  /** Number of files that will be embedded (uploaded) because they can't be linked. */
  embedded: number
  /** The files that will be embedded, with the reason each one can't be linked. */
  embeddedFiles: ModrinthLinkagePreviewEntry[]
}

export interface ModrinthChangelogContext {
  /** Whether a previous publish was recorded to diff against. */
  hasPreviousVersion: boolean
  /** File paths present now but not in the last publish. */
  added: string[]
  /** File paths present in the last publish but not now. */
  removed: string[]
  /** Files that appear to be the same mod updated to a different file/version. */
  updated: Array<{ from: string; to: string }>
}

export type ModrinthPackProfile = 'universal' | 'client' | 'server' | 'split'

export interface PublishModrinthOptions extends Omit<ExportModpackOptions, 'emitCurseforge' | 'emitModrinth' | 'emitOffline' | 'showInFolder'> {
  profile: ModrinthPackProfile
  project: { id: string } | { create: CreateModrinthProjectData; iconPath?: string }
  release: Omit<CreateModrinthVersionData, 'project_id'>
}

export interface PublishModrinthResult {
  projectId: string
  versionId: string
  artifacts: Array<{ profile: Exclude<ModrinthPackProfile, 'split'>; path: string }>
}

export interface SubmitModrinthVersionOptions {
  instancePath: string
  projectId: string
  versionId: string
}

export interface CreateAndBindModrinthProjectOptions {
  instancePath: string
  project: CreateModrinthProjectData
  requestedStatus?: 'approved' | 'unlisted' | 'private'
  iconPath?: string
}

export interface UpdateBoundModrinthProjectOptions {
  instancePath: string
  projectId: string
  project: UpdateModrinthProjectData
  iconPath?: string
}

export interface AddModrinthGalleryImageOptions {
  instancePath: string
  projectId: string
  imagePath: string
  featured: boolean
  title?: string
  description?: string
  ordering?: number
}

export type ImportModpackOptions = ImportModpackCreateInstanceOptions

export interface ImportModpackToInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string
  /**
   * The destination instance path. If this is empty, it will create a new instance.
   */
  instancePath: string
  /**
   * Mount the instance after the modpack is imported
   */
  mountAfterSucceed?: boolean
}

export interface ImportModpackCreateInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string

  instanceConfig: Omit<CreateInstanceOption, 'path'>
  /**
   * Mount the instance after the modpack is imported
   */
  mountAfterSucceed?: boolean
}

export class ModpackState {
  modpackPath: string = ''
  config!: ModpackInstallProfile['instance']

  files: InstanceFile[] = []
  ready = false
  error = undefined as any

  modpackFiles(files: InstanceFile[]) {
    this.ready = true
    this.files = files
  }

  modpackError(error: Error) {
    this.ready = false
    this.error = error
  }
}

/**
 * Provide the abilities to parse the modpack files data.
 * For json format modpack like FTB, you can use the `InstanceIOService` to do the actual install operation.
 */
export interface ModpackService {
  /**
   * Install the modpack from market to local cache.
   * @returns The installed modpack path
   */
  installModapckFromMarket(options: InstallMarketOptions): Promise<string[]>
  /**
   * Export the instance as an curseforge/modrinth/mcbbs modpack
   * @param options The curseforge/modrinth/mcbbs modpack export options
   */
  exportModpack(options: ExportModpackOptions): Promise<ExportModpackResult>
  createAndBindModrinthProject(options: CreateAndBindModrinthProjectOptions): Promise<Project>
  bindModrinthProject(instancePath: string, projectId: string): Promise<Project>
  /**
   * Unbind the Modrinth project currently associated with this instance. This
   * only clears the local association; it does not modify or delete anything
   * on Modrinth.
   */
  unbindModrinthProject(instancePath: string): Promise<void>
  updateBoundModrinthProject(options: UpdateBoundModrinthProjectOptions): Promise<Project>
  addModrinthGalleryImage(options: AddModrinthGalleryImageOptions): Promise<Project>
  updateModrinthGalleryImage(instancePath: string, projectId: string, imageUrl: string, data: { featured?: boolean; title?: string; description?: string; ordering?: number }): Promise<Project>
  deleteModrinthGalleryImage(instancePath: string, projectId: string, imageUrl: string): Promise<Project>
  publishModrinth(options: PublishModrinthOptions): Promise<PublishModrinthResult>
  submitModrinthVersion(options: SubmitModrinthVersionOptions): Promise<void>
  /**
   * Preview which of the given mods/resourcepacks/shaderpacks can be represented
   * in a Modrinth modpack manifest by a download link, versus which ones must be
   * embedded (uploaded) as raw files.
   */
  previewModrinthLinkage(instancePath: string, files: ExportFileDirective[], strictModeInModrinth?: boolean): Promise<ModrinthLinkagePreview>
  /**
   * Compare the given file selection against the last successful Modrinth
   * publish for this instance, returning added/removed/updated mods to help
   * summarize changes for a changelog.
   */
  previewModrinthChangelogContext(instancePath: string, files: ExportFileDirective[]): Promise<ModrinthChangelogContext>
  /**
   * Open an modpack to install. Use the `installInstanceFiles` to create an instance.
   */
  openModpack(modpackPath: string): Promise<SharedState<ModpackState>>
  /**
   * Import the modpack as an instance
   * @param modpackPath The modpack file path
   * @param iconUrl The icon url of the modpack
   * @param upstream The upstream data source of the modpack
   * @param instancePath When provided and pointing to an existing instance, the
   * modpack is installed into (updates) that instance instead of creating a new
   * one. Otherwise a new instance is created.
   * @returns The instance path
   */
  importModpack(modpackPath: string, iconUrl?: string, upstream?: InstanceData['upstream'], instancePath?: string): Promise<{
    instancePath: string
    version?: string
    runtime: PartialRuntimeVersions
  }>
  /**
   * Show the modpack folder
   */
  showModpacksFolder(): Promise<void>

  watchModpackFolder(): Promise<SharedState<ResourceState>>

  removeModpack(path: string): Promise<void>
}

export function waitModpackFiles(modpack: SharedState<ModpackState>) {
  return new Promise<InstanceFile[]>((resolve, reject) => {
    if (modpack.ready) {
      resolve(modpack.files)
    } else {
      let counter = 0
      const i = setInterval(() => {
        if (modpack.ready) {
          resolve(modpack.files)
          modpack.unsubscribe('modpackFiles', onFiles)
          clearInterval(i)
        }
        if (modpack.error) {
          reject(modpack.error)
          modpack.unsubscribe('modpackFiles', onFiles)
          clearInterval(i)
        }
        counter++
        if (counter > 90) {
          // If the modpack is not ready in X seconds, we will stop waiting
          reject(new Error('Modpack is not ready'))
          modpack.unsubscribe('modpackFiles', onFiles)
          clearInterval(i)
        }
      }, 1000)
      function onFiles(files: InstanceFile[]) {
        resolve(files)
        modpack.unsubscribe('modpackFiles', onFiles)
        clearInterval(i)
      }
      modpack.subscribe('modpackFiles', onFiles)
    }
  })
}

export const ModpackServiceKey: ServiceKey<ModpackService> = 'ModpackService'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

export type ModpackExceptions = {
  type: 'invalidModpack' | 'requireModpackAFile'
  path: string
} | {
  /**
   * This is thrown when some files cannot be installed
   */
  type: 'modpackInstallFailed'
  /**
   * This is all the files
   */
  files: Array<ModpackDownloadableFile>
} | {
  /**
   * This is due to some curesforge mods disabled the thirdparty download url
   */
  type: 'modpackInstallPartial'
  /**
   * This is all the files
   */
  files: Array<ModpackDownloadableFile>
  /**
   * The curseforge files need to be manually installed
   */
  missingFiles: Array<{
    projectId: number
    fileId: number
  }>
}

export class ModpackException extends Exception<ModpackExceptions> { }
