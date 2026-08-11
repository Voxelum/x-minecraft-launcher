import { CurseforgeV1Client } from '@xmcl/curseforge'
import {
  InstanceLockSchema,
  PartialRuntimeVersions,
  getCurseforgeModpackFromInstance,
  getMmcLocalLibraryNames,
  getMmcVersionFromManifest,
  getModrinthModpackFromInstance,
  type CurseforgeModpackManifest,
  type Instance,
  type InstanceData,
  type InstanceFile,
  type MMCModpackManifest,
  type ModpackInstallProfile,
  type ModrinthModpackManifest
} from '@xmcl/instance'
import { ModerinthApiError, ModrinthV2Client, type ModrinthUploadFile } from '@xmcl/modrinth'
import { isValidCurseforgeRef, isValidModrinthRef, ResourceManager, ResourceMetadata, UpdateResourcePayload } from '@xmcl/resource'
import {
  ModpackException,
  ModpackServiceKey,
  ModpackState,
  ResourceState,
  findMatchedVersion,
  isAllowInModrinthModpack,
  type CreateInstanceOption,
  type CreateAndBindModrinthProjectOptions,
  type AddModrinthGalleryImageOptions,
  type ExportFileDirective,
  type ExportModpackOptions,
  type ExportModpackResult,
  type ExportModpackTask,
  type ModrinthPackProfile,
  type ModpackService as IModpackService,
  type PublishModrinthOptions,
  type PublishModrinthResult,
  type SubmitModrinthVersionOptions,
  type UpdateBoundModrinthProjectOptions,
  type InstallMarketOptions,
  type SharedState,
} from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { AnyError } from '@xmcl/utils'
import { LibraryInfo } from '@xmcl/core'
import filenamify from 'filenamify'
import { ensureDir, ensureFile, readFile, readJson, stat, unlink, writeFile } from 'fs-extra'
import { basename, dirname, extname, join, relative } from 'path'
import { Entry, ZipFile as YauzlZipFile } from '@xmcl/yauzl'
import { ZipFile } from 'yazl'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { ZipManager, kTasks, type Tasks } from '~/infra'
import { InstanceService } from '~/instance'
import { InstanceInstallService } from '~/instanceIO'
import { VersionService } from '~/launch'
import { UserService } from '~/user'
import { kMarketProvider } from '~/market'
import { kResourceManager, kResourceWorker, type ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { getTracker } from '~/util/taskHelper'
import { requireObject } from '../util/object'
import { ZipTrackerEvents, writeZipFile } from '../util/zip'
import { createCurseforgeHandler } from './utils/curseforgeHandler'
import { exportOfflineModpack } from './utils/exportOffline'
import { createMcbbsHandler } from './utils/mcbbsHandler'
import { createMmcHandler } from './utils/mmcHandler'
import { createModrinthHandler } from './utils/modrinthHandler'
import { remapModpackZipDownloads } from './utils/remapZipDownloads'
import { addExportFileAsOverride, getModrinthProfileFiles, isServerOnlyExportFile } from './exportArchiveFiles'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

/**
 * Narrow a resolved modpack manifest to a MultiMC / Prism manifest, which carries
 * an `mmc-pack.json` component list (`json.components`) and an `instance.cfg`
 * (`cfg`).
 */
function isMMCModpackManifest(manifest: unknown): manifest is MMCModpackManifest {
  const m = manifest as MMCModpackManifest | undefined
  return (
    !!m &&
    typeof m === 'object' &&
    !!m.cfg &&
    !!m.json &&
    Array.isArray(m.json.components)
  )
}

type SelectedXMCLFields = Pick<
  InstanceData,
  | 'disableElybyAuthlib'
  | 'disableAuthlibInjector'
  | 'upstream'
  | 'server'
  | 'resolution'
  | 'showLog'
  | 'hideLauncher'
>

const MODRINTH_PRIVATE_PATHS = [
  /(^|\/)servers\.dat$/i,
  /(^|\/)(eula\.txt|ops\.json|whitelist\.json|banned-ips\.json|banned-players\.json|usercache\.json)$/i,
  /(^|\/)(logs|crash-reports|cache|caches|world|playerdata|stats|advancements)(\/|$)/i,
  /(^|\/)(launcher_accounts|launcher_profiles|accounts|credentials|secrets|tokens?)\b/i,
  /\.(pem|key|pfx|p12)$/i,
]

function isPrivateModrinthPath(path: string) {
  return MODRINTH_PRIVATE_PATHS.some((pattern) => pattern.test(path.replaceAll('\\', '/')))
}

function getImageMimeType(path: string) {
  const extension = extname(path).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

function createDefaultModpackMetadata() {
  return {
    version: 0 as const,
    exportDirectory: '',
    modpackVersion: '0.0.1',
    emitCurseforge: false,
    emitModrinth: true,
    emitModrinthStrict: true,
    emitOffline: false,
    emittedFiles: [],
    emittedServerFiles: [],
    filesEnvironments: {},
    modrinth: {
      projectId: '',
      profile: 'client' as const,
      versionType: 'release' as const,
      pendingProjectStatus: undefined,
      lastVersionId: '',
      lastPublishedAt: 0,
      lastPublishedFiles: [] as string[],
      artifacts: [],
    },
  }
}

const transformFile = (file: InstanceFile) => {
  file.path = file.path.replaceAll('\\', '/')
  return file
}

const transformInstance = <T extends { files: InstanceFile[] }>(o: T) => {
  for (const file of o.files) transformFile(file)
  return o
}

export interface ModpackHandler<M = any> {
  /**
   * @return The relative path of the entry after unpack to the instance root. `undefine` means not to unpack.
   */
  resolveUnpackPath(manifest: M, e: Entry): string | void

  readManifest(zipFile: YauzlZipFile, entries: Entry[]): Promise<M | undefined>
  resolveInstanceOptions(manifest: M): ModpackInstallProfile['instance']
  resolveInstanceFiles(manifest: M): Promise<InstanceFile[]>

  /**
   * Resolve the additional market metadata for the modpack
   */
  resolveModpackMarketMetadata?(path: string, sha1: string): Promise<ResourceMetadata | undefined>
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(ModpackServiceKey)
export class ModpackService extends AbstractService implements IModpackService {
  private handlers: Record<string, ModpackHandler> = {}

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kResourceManager) private resourceManager: ResourceManager,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
    this.handlers['curseforge'] = createCurseforgeHandler(app)
    this.handlers['mcbbs'] = createMcbbsHandler(app)
    this.handlers['mmc'] = createMmcHandler(app)
    this.handlers['modrinth'] = createModrinthHandler(app)
  }

  async installModapckFromMarket(options: InstallMarketOptions): Promise<string[]> {
    const provider = await this.app.registry.get(kMarketProvider)
    const result = await provider.installFile({
      ...options,
      directory: this.getPath('modpacks'),
    })
    const paths = result.map((r) => r.path)
    if (paths.length === 0) {
      throw new ModpackException(
        { type: 'invalidModpack', path: '' },
        'The marketplace did not return a modpack file.',
      )
    }
    return paths
  }

  async importModpack(
    modpackFile: string,
    iconUrl?: string,
    upstream?: InstanceData['upstream'],
    instancePath?: string,
  ): Promise<{
    instancePath: string
    version?: string
    runtime: PartialRuntimeVersions
  }> {
    if (typeof modpackFile !== 'string' || modpackFile.length === 0) {
      throw new ModpackException({ type: 'invalidModpack', path: '' })
    }
    this.log(`Import modpack ${modpackFile}`)
    const zipManager = await this.app.registry.getOrCreate(ZipManager)
    const cached = await this.getCachedInstallProfile(modpackFile)
    const zip = await zipManager.open(modpackFile)
    const instanceInstallService = await this.app.registry.get(InstanceInstallService)

    const entries = Object.values(zip.entries)
    const [manifest, handler] = await this.getManifestAndHandler(zip.file, entries)

    if (!manifest || !handler)
      throw new ModpackException({ type: 'invalidModpack', path: modpackFile })

    const instance = handler.resolveInstanceOptions(manifest)

    const versionService = await this.app.registry.get(VersionService)
    const files = await this.#processFiles(handler, modpackFile, manifest, cached.sha1, entries)

    const name = instance.name

    // Prism / MultiMC packs can override the launch configuration (mainClass,
    // extra classpath libraries, ...) via `patches/*.json`. When they do, bake
    // the merged result into a standalone version json and pin it, so xmcl does
    // not regenerate the Forge version json and drop those overrides (gh #1555).
    // The merged version still carries the loader libraries, so mod-loader
    // detection keeps working and the runtime is left untouched.
    let mmcVersionId: string | undefined
    if (isMMCModpackManifest(manifest)) {
      mmcVersionId = await this.#applyMmcStandaloneVersion(manifest, zip.file, entries, name)
        .catch((e) => {
          this.warn(new AnyError('ImportModpackError', `Failed to apply MultiMC patches: ${e}`))
          return undefined
        })
    }

    const matchedVersion = findMatchedVersion(versionService.state.local, '', instance.runtime)
    if (matchedVersion) {
      this.log('Found matched version', matchedVersion, instance.runtime)
    }

    const hasShaderpacks = files.some((f) => f.path.startsWith('shaderpacks/'))
    const hasResourcepacks = files.some((f) => f.path.startsWith('resourcepacks/'))
    const options: CreateInstanceOption = {
      ...instance,
      name,
      version: mmcVersionId || matchedVersion?.id || instance.version,
      shaderpacks: hasShaderpacks,
      resourcepacks: hasResourcepacks,
      icon: iconUrl,
    }

    if (upstream) {
      options.upstream = upstream
      ;(options.upstream as any).sha1 = cached.sha1
    }

    // If an existing instance is targeted, update it in place instead of
    // creating a new one. This backs the "update existing instance" choice
    // shown when a modpack for an already-installed instance is imported.
    const existing =
      instancePath &&
      (this.instanceService.state.all[instancePath] ||
        this.instanceService.state.instances.find((i) => i.path === instancePath))

    let path: string
    if (existing) {
      path = existing.path
      await this.instanceService.editInstance({
        instancePath: path,
        runtime: options.runtime,
        version: options.version,
        ...(options.upstream ? { upstream: options.upstream } : {}),
      }).catch((e) => {
        this.error(e)
      })
    } else {
      path = await this.instanceService.createInstance(options)
    }

    instanceInstallService
      .installInstanceFiles(
        upstream
          ? {
              path,
              files,
              upstream,
            }
          : {
              path,
              files,
              oldFiles: [],
            },
      )
      .catch((e) => {
        this.error(e)
      })

    return {
      instancePath: path,
      version: options.version,
      runtime: instance.runtime!,
    }
  }

  private async getInstanceLockLookup(instancePath: string): Promise<Record<string, InstanceFile>> {
    const instanceLockContent: InstanceLockSchema | undefined = await readJson(
      join(instancePath, 'instance-lock.json'),
    )
      .then(InstanceLockSchema.parse)
      .catch(() => undefined)
    return Object.fromEntries(
      instanceLockContent?.files.map((f) => [f.path, f]) || [],
    )
  }

  private async lookupExportFile(
    instancePath: string,
    filePath: string,
    lockHashLookup: Record<string, InstanceFile>,
    emitModrinth: boolean | undefined,
    emitCurseforge: boolean | undefined,
  ) {
    const fStat = await stat(filePath).catch(() => null)
    if (!fStat?.isFile()) {
      return undefined
    }
    const relativePath = relative(instancePath, filePath).replaceAll('\\', '/')
    const lockedFile = lockHashLookup[relativePath] as InstanceFile | undefined
    if (lockedFile) {
      // check if the file metadata is enough
      const modrinthOk =
        !emitModrinth ||
        (!!lockedFile.modrinth && !!lockedFile.hashes?.sha1 && !!lockedFile.hashes?.sha512)
      const curseforgeOk =
        !emitCurseforge || (!!lockedFile.curseforge && !!lockedFile.hashes?.sha1)
      if (modrinthOk && curseforgeOk) {
        return lockedFile
      }
    }

    const sha1: string =
      lockedFile?.hashes?.sha1 ??
      (await this.resourceManager
        .getSnapshotByIno(fStat.ino)
        .then(async (s) => s?.sha1 ?? (await this.worker.checksum(filePath, 'sha1'))))
    const metadata = await this.resourceManager.getMetadataByHash(sha1)
    const downloads = await this.resourceManager
      .getUriByHash(sha1)
      .then((uris) => uris.filter((u) => u.startsWith('http')))
    return {
      ...lockedFile,
      path: relativePath,
      hashes: { ...lockedFile?.hashes, sha1 },
      ...metadata,
      downloads: [...(lockedFile?.downloads || []), ...downloads],
    }
  }

  /**
   * Preview which of the given mods/resourcepacks/shaderpacks can be represented
   * in a Modrinth modpack manifest by a download link (because they are already
   * linked to a known Modrinth resource with a redistributable download url),
   * versus which ones will have to be embedded as raw files (overrides) because
   * they cannot be linked. Files forced as `override`, and files outside of
   * `mods/`, `resourcepacks/`, `shaderpacks/` (e.g. config files), are always
   * embedded by design and are not included in this preview.
   */
  async previewModrinthLinkage(
    instancePath: string,
    files: ExportFileDirective[],
    strictModeInModrinth?: boolean,
  ) {
    requireObject(files)
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new TypeError(`Cannot preview unmanaged instance ${instancePath}`)
    }

    const lockHashLookup = await this.getInstanceLockLookup(instancePath)
    const entries: Array<{ path: string; linked: boolean; reason?: 'missing-file' | 'not-linked-to-modrinth' | 'no-downloadable-url' }> = []
    const pending: Array<{ path: string; filePath: string; sha1: string }> = []

    for (const file of files) {
      const isCandidate = !file.override && (
        file.path.startsWith('mods/') ||
        file.path.startsWith('resourcepacks/') ||
        file.path.startsWith('shaderpacks/')
      )
      if (!isCandidate) continue

      const filePath = join(instancePath, file.source || file.path)
      const fileLike = await this.lookupExportFile(instancePath, filePath, lockHashLookup, true, false)
      if (!fileLike) {
        entries.push({ path: file.path, linked: false, reason: 'missing-file' })
        continue
      }
      if (!fileLike.modrinth) {
        entries.push({ path: file.path, linked: false, reason: 'not-linked-to-modrinth' })
        continue
      }
      const availableDownloads = (fileLike.downloads || []).filter((u) => isAllowInModrinthModpack(u, strictModeInModrinth))
      if (availableDownloads.length > 0) {
        entries.push({ path: file.path, linked: true })
      } else {
        const sha1 = fileLike.hashes?.sha1 || (await this.worker.checksum(filePath, 'sha1'))
        pending.push({ path: file.path, filePath, sha1 })
      }
    }

    if (pending.length > 0) {
      const modrinthClient = await this.app.registry.get(ModrinthV2Client)
      const result = await modrinthClient
        .getProjectVersionsByHash(pending.map((p) => p.sha1), 'sha1')
        .catch(() => ({}) as Record<string, { files: Array<{ hashes: { sha1: string } }> }>)
      for (const p of pending) {
        const version = result[p.sha1]
        const matched = version?.files.find((f) => f.hashes.sha1 === p.sha1)
        entries.push(
          matched
            ? { path: p.path, linked: true }
            : { path: p.path, linked: false, reason: 'no-downloadable-url' },
        )
      }
    }

    const embeddedFiles = entries.filter((e) => !e.linked)
    return {
      total: entries.length,
      linked: entries.length - embeddedFiles.length,
      embedded: embeddedFiles.length,
      embeddedFiles,
    }
  }

  /**
   * Compare the given mods/resourcepacks/shaderpacks file selection against the
   * file set used in the last successful Modrinth publish, to help summarize
   * what changed for a changelog. This is a best-effort, filename-based diff
   * (no network calls): a file present now but not in the last publish is
   * "added", one that was present before but isn't now is "removed", and pairs
   * of added/removed files that share a common name prefix (e.g. the same mod
   * updated to a new version) are reported as "updated" instead.
   */
  async previewModrinthChangelogContext(instancePath: string, files: ExportFileDirective[]) {
    requireObject(files)
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      throw new TypeError(`Cannot preview unmanaged instance ${instancePath}`)
    }

    const metadata = await this.instanceService.getInstanceModpackMetadata(instancePath)
    const previousFiles = metadata?.modrinth.lastPublishedFiles ?? []
    const isRelevant = (path: string) =>
      path.startsWith('mods/') || path.startsWith('resourcepacks/') || path.startsWith('shaderpacks/')

    const currentSet = new Set(files.map((f) => f.path).filter(isRelevant))
    const previousSet = new Set(previousFiles.filter(isRelevant))

    const addedPaths = [...currentSet].filter((p) => !previousSet.has(p))
    const removedPaths = [...previousSet].filter((p) => !currentSet.has(p))

    const stemOf = (path: string) => {
      const base = path.substring(path.lastIndexOf('/') + 1).replace(/\.(jar|zip)$/i, '')
      // Strip a trailing version-looking suffix, e.g. "-1.2.3", "-mc1.20.1-4.5", "+1.2.0"
      return base.replace(/[-_+]v?\d[\w.+-]*$/i, '').toLowerCase()
    }

    const removedByStem = new Map<string, string>()
    for (const path of removedPaths) removedByStem.set(stemOf(path), path)

    const added: string[] = []
    const updated: Array<{ from: string; to: string }> = []
    const removedMatched = new Set<string>()
    for (const path of addedPaths) {
      const stem = stemOf(path)
      const previous = removedByStem.get(stem)
      if (previous && !removedMatched.has(previous)) {
        updated.push({ from: previous, to: path })
        removedMatched.add(previous)
      } else {
        added.push(path)
      }
    }
    const removed = removedPaths.filter((p) => !removedMatched.has(p))

    return {
      hasPreviousVersion: previousFiles.length > 0,
      added,
      removed,
      updated,
    }
  }

  /**
   * Export the instance as an modpack
   * @param options The modpack export options
   */
  async exportModpack(options: ExportModpackOptions): Promise<ExportModpackResult> {
    requireObject(options)

    const {
      instancePath,
      destinationDirectory,
      files,
      name,
      version,
      gameVersion,
      author,
      emitCurseforge,
      emitModrinth,
      emitOffline,
    } = options

    const instance = this.instanceService.state.all[instancePath]
    if (!instance) {
      this.warn(`Cannot export unmanaged instance ${instancePath}`)
      return {}
    }

    if (!emitCurseforge && !emitModrinth && !emitOffline) {
      return {}
    }

    let curseforgeConfig: CurseforgeModpackManifest | undefined
    let modrinthManifest: ModrinthModpackManifest | undefined
    let xmclManifestExtension: SelectedXMCLFields = {
      disableElybyAuthlib: instance.disableElybyAuthlib,
      disableAuthlibInjector: instance.disableAuthlibInjector,
      upstream: instance.upstream,
      server: instance.server,
      resolution: instance.resolution,
      showLog: instance.showLog,
      hideLauncher: instance.hideLauncher,
    }

    if (emitCurseforge) {
      curseforgeConfig = getCurseforgeModpackFromInstance(instance)
      curseforgeConfig.author = author ?? curseforgeConfig.author
      curseforgeConfig.name = name ?? curseforgeConfig.name
      curseforgeConfig.version = version ?? curseforgeConfig.version
    }

    if (emitModrinth) {
      modrinthManifest = getModrinthModpackFromInstance(instance)
      modrinthManifest.versionId = version ?? modrinthManifest.versionId
    }

    const parentDir = destinationDirectory || this.app.host.getPath('downloads')
    // Sanitize name and version to ensure they are valid for filenames on all platforms
    const sanitizedName = filenamify(name, { replacement: '_' })
    const sanitizedVersion = filenamify(version, { replacement: '_' })
    const curseforgeZip = emitCurseforge ? new ZipFile() : undefined
    const curseforgeZipPath = emitCurseforge ? join(parentDir, `${sanitizedName}-${sanitizedVersion}.zip`) : ''
    const hasCurseforgeServerPack = !!emitCurseforge && files.some(isServerOnlyExportFile)
    const curseforgeServerZip = hasCurseforgeServerPack ? new ZipFile() : undefined
    const curseforgeServerZipPath = hasCurseforgeServerPack ? join(parentDir, `${sanitizedName}-server-${sanitizedVersion}.zip`) : ''
    const modrinthZip = emitModrinth ? new ZipFile() : undefined
    const modrinthZipPath = emitModrinth ? join(parentDir, `${sanitizedName}-${sanitizedVersion}.mrpack`) : ''
    const offlineZip = emitOffline ? new ZipFile() : undefined
    const offlineZipPath = emitOffline ? join(parentDir, `${sanitizedName}-${sanitizedVersion}-offline.zip`) : ''

    curseforgeZip?.addEmptyDirectory('overrides')
    modrinthZip?.addEmptyDirectory('overrides')

    const xmclJson = Buffer.from(JSON.stringify(xmclManifestExtension, null, 4))
    curseforgeZip?.addBuffer(xmclJson, 'xmcl.json')
    modrinthZip?.addBuffer(xmclJson, 'xmcl.json')
    offlineZip?.addBuffer(xmclJson, 'xmcl.json')

    const backfillModrinth: [ModrinthModpackManifest['files'][number], UpdateResourcePayload][] = []
    const backfillCurseforge: { filePath: string; relativePath: string; sha1: string }[] = []
    const lockHashLookup = await this.getInstanceLockLookup(instancePath)

    const lookupFile = (filePath: string) => this.lookupExportFile(instancePath, filePath, lockHashLookup, emitModrinth, emitCurseforge)

    if (offlineZip) {
      const versionService = await this.app.registry.get(VersionService)
      const resolved = await versionService.resolveLocalVersion(gameVersion)
      await exportOfflineModpack(offlineZip, this.getPath(), resolved)
    }

    const addAsOverride = (src: string, path: string, env?: ExportModpackOptions['files'][number]['env']) => {
      addExportFileAsOverride(
        { curseforge: curseforgeZip, curseforgeServer: curseforgeServerZip, modrinth: modrinthZip },
        src,
        { path, env },
      )
    }

    for (const file of files) {
      const filePath = join(instancePath, file.source || file.path)
      // Add offline anyway
      offlineZip?.addFile(filePath, file.path)
      if (isServerOnlyExportFile(file)) {
        addAsOverride(filePath, file.path, file.env)
        continue
      }
      if (
        file.path.startsWith('mods/') ||
        file.path.startsWith('resourcepacks/') ||
        file.path.startsWith('shaderpacks/')
      ) {
        if (file.override) {
          addAsOverride(filePath, file.path, file.env)
        } else {
          const fileLike = await lookupFile(filePath)
          if (!fileLike) {
            addAsOverride(filePath, file.path, file.env)
            continue
          }

          if (fileLike.curseforge) {
            curseforgeConfig?.files?.push({
              projectID: fileLike.curseforge.projectId,
              fileID: fileLike.curseforge.fileId,
              required: true,
            })
          } else if (emitCurseforge) {
            // No curseforge metadata, add to backfill list to try fingerprint lookup
            const sha1 = fileLike.hashes?.sha1 || (await this.worker.checksum(filePath, 'sha1'))
            backfillCurseforge.push({ filePath, relativePath: file.path, sha1 })
          }
          if (fileLike.modrinth) {
            // modrinth not allowed to include curseforge source by regulation
            const urls = fileLike.downloads || []
            const availableDownloads = urls.filter((u) =>
              isAllowInModrinthModpack(u, options.strictModeInModrinth),
            )
            const env = {} as Record<string, string>
            if (file.env?.client) {
              env.client = file.env.client
            }
            if (file.env?.server) {
              env.server = file.env.server
            }

            const result = {
              path: file.path,
              hashes: {
                sha1: fileLike.hashes.sha1 || (await this.worker.checksum(filePath, 'sha1')),
                sha512: await this.worker.checksum(filePath, 'sha512'),
              },
              downloads: availableDownloads,
              fileSize: (await stat(filePath)).size,
              env: Object.keys(env).length > 0 ? (env as any) : undefined,
            }

            if (availableDownloads.length === 0) {
              backfillModrinth.push([
                result,
                {
                  hash: result.hashes.sha1,
                  metadata: fileLike,
                  uris: urls,
                },
              ])
            } else {
              modrinthManifest?.files.push(result)
            }
          } else {
            modrinthZip?.addFile(filePath, `overrides/${file.path}`)
          }
        }
      } else {
        addAsOverride(filePath, file.path, file.env)
      }
    }

    if (backfillModrinth.length > 0) {
      const modrinthClient = await this.app.registry.get(ModrinthV2Client)
      const result = await modrinthClient.getProjectVersionsByHash(
        backfillModrinth.map((v) => v[1].hash),
        'sha1',
      )

      for (const [file, resource] of backfillModrinth) {
        const version = result[resource.hash]
        if (version) {
          const matched = version.files.find((f) => f.hashes.sha1 === file.hashes.sha1)
          if (matched) {
            file.downloads.push(matched.url)
            modrinthManifest?.files.push(file)
            await this.resourceManager.updateMetadata([
              {
                hash: resource.hash,
                uris: [...(resource.uris || []), matched.url],
                metadata: {
                  modrinth: {
                    projectId: version.project_id,
                    versionId: version.id,
                  },
                },
              },
            ])
            continue
          }
        }

        const filePath = join(instancePath, file.path)
        modrinthZip?.addFile(filePath, `overrides/${file.path}`)
      }
    }

    // Backfill CurseForge metadata using fingerprint matching
    if (backfillCurseforge.length > 0) {
      const curseforgeClient = await this.app.registry.get(CurseforgeV1Client)
      const fingerprintMap: Record<
        number,
        { filePath: string; relativePath: string; sha1: string }
      > = {}

      // Calculate fingerprints for all files
      for (const item of backfillCurseforge) {
        try {
          const fingerprint = await this.worker.fingerprint(item.filePath)
          fingerprintMap[fingerprint] = item
        } catch (e) {
          this.warn(`Failed to calculate fingerprint for ${item.filePath}, adding as override`)
          curseforgeZip?.addFile(item.filePath, `overrides/${item.relativePath}`)
        }
      }

      // Query CurseForge API with fingerprints
      const fingerprints = Object.keys(fingerprintMap).map((v) => parseInt(v, 10))
      const result = await curseforgeClient
        .getFingerprintsMatchesByGameId(432, fingerprints)
        .catch(() => ({ exactMatches: [] }))

      const matchedFingerprints = new Set<number>()
      for (const match of result.exactMatches) {
        const item = fingerprintMap[match.file.fileFingerprint]
        if (item) {
          matchedFingerprints.add(match.file.fileFingerprint)
          curseforgeConfig?.files?.push({
            projectID: match.file.modId,
            fileID: match.file.id,
            required: true,
          })
          // Update metadata for future exports
          this.resourceManager
            .updateMetadata([
              {
                hash: item.sha1,
                metadata: {
                  curseforge: {
                    projectId: match.file.modId,
                    fileId: match.file.id,
                  },
                },
              },
            ])
            .catch((e) => {
              this.warn(`Failed to update curseforge metadata for ${item.filePath}`)
            })
        }
      }

      // Add unmatched files as overrides
      for (const [fingerprint, item] of Object.entries(fingerprintMap)) {
        if (!matchedFingerprints.has(parseInt(fingerprint, 10))) {
          curseforgeZip?.addFile(item.filePath, `overrides/${item.relativePath}`)
        }
      }
    }

    if (curseforgeConfig) {
      this.log(
        `Export instance ${instancePath} to curseforge ${JSON.stringify(curseforgeConfig, null, 4)}`,
      )
      curseforgeZip?.addBuffer(
        Buffer.from(JSON.stringify(curseforgeConfig, null, 4)),
        'manifest.json',
      )
    }

    if (modrinthManifest) {
      this.log(
        `Export instance ${instancePath} to modrinth ${JSON.stringify(modrinthManifest, null, 4)}`,
      )
      modrinthZip?.addBuffer(
        Buffer.from(JSON.stringify(modrinthManifest, null, 4)),
        'modrinth.index.json',
      )
    }

    const task = this.tasks.create<ExportModpackTask>({
      type: 'exportModpack',
      key: `export-modpack-${instancePath}`,
      instancePath,
      name: name!,
    })

    const tracker = getTracker<ZipTrackerEvents>(task)

    try {
      if (curseforgeZip) {
        await writeZipFile(curseforgeZip, curseforgeZipPath, task.controller.signal, tracker)
      }
      if (curseforgeServerZip) {
        await writeZipFile(curseforgeServerZip, curseforgeServerZipPath, task.controller.signal, tracker)
      }
      if (modrinthZip) {
        await writeZipFile(modrinthZip, modrinthZipPath, task.controller.signal, tracker)
      }
      if (offlineZip) {
        await writeZipFile(offlineZip, offlineZipPath, task.controller.signal, tracker)
      }
      task.complete()
    } catch (error) {
      task.fail(error)
      throw error
    }

    const destinationPath = modrinthZipPath || curseforgeZipPath || offlineZipPath
    if (destinationPath && options.showInFolder !== false) {
      this.app.shell.showItemInFolder(destinationPath)
    }
    return {
      curseforge: curseforgeZipPath || undefined,
      curseforgeServer: curseforgeServerZipPath || undefined,
      modrinth: modrinthZipPath || undefined,
      offline: offlineZipPath || undefined,
    }
  }

  async createAndBindModrinthProject(options: CreateAndBindModrinthProjectOptions) {
    requireObject(options)
    const instance = this.instanceService.state.all[options.instancePath]
    if (!instance) {
      throw new TypeError(`Cannot bind project to unmanaged instance ${options.instancePath}`)
    }
    const icon = options.iconPath
      ? {
          fileName: basename(options.iconPath),
          data: new Blob([await readFile(options.iconPath)], { type: getImageMimeType(options.iconPath) }),
        }
      : undefined
    const { requested_status: ignoredRequestedStatus, ...draftProject } = options.project
    const requestedStatus = options.requestedStatus ?? (ignoredRequestedStatus === 'approved' || ignoredRequestedStatus === 'unlisted' || ignoredRequestedStatus === 'private' ? ignoredRequestedStatus : undefined)
    const project = await this.callAuthenticatedModrinth((client) => client.createProject({
      ...draftProject,
      status: 'draft',
    }, icon))
    const metadata = await this.instanceService.getInstanceModpackMetadata(options.instancePath)
    await this.instanceService.setInstanceModpackMetadata(options.instancePath, {
      ...(metadata ?? createDefaultModpackMetadata()),
      modrinth: {
        ...(metadata?.modrinth ?? createDefaultModpackMetadata().modrinth),
        projectId: project.id,
        pendingProjectStatus: requestedStatus,
      },
    })
    return project
  }

  async bindModrinthProject(instancePath: string, projectId: string) {
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) throw new TypeError(`Cannot bind project to unmanaged instance ${instancePath}`)
    const [project, user, members] = await this.callAuthenticatedModrinth((client) => Promise.all([
      client.getProject(projectId), client.getAuthenticatedUser(), client.getProjectTeamMembers(projectId),
    ]))
    const membership = members.find((member) => member.user.id === user.id && member.accepted)
    if (!membership || (membership.permissions & 1) === 0) throw new TypeError(`Current Modrinth account cannot upload versions to project ${projectId}`)
    const metadata = await this.instanceService.getInstanceModpackMetadata(instancePath)
    await this.instanceService.setInstanceModpackMetadata(instancePath, {
      ...(metadata ?? createDefaultModpackMetadata()),
      modrinth: { ...(metadata?.modrinth ?? createDefaultModpackMetadata().modrinth), projectId },
    })
    return project
  }

  async unbindModrinthProject(instancePath: string) {
    const instance = this.instanceService.state.all[instancePath]
    if (!instance) throw new TypeError(`Cannot unbind project from unmanaged instance ${instancePath}`)
    const metadata = await this.instanceService.getInstanceModpackMetadata(instancePath)
    if (!metadata?.modrinth.projectId) return
    const defaults = createDefaultModpackMetadata()
    await this.instanceService.setInstanceModpackMetadata(instancePath, {
      ...metadata,
      modrinth: {
        ...defaults.modrinth,
        profile: metadata.modrinth.profile,
        versionType: metadata.modrinth.versionType,
      },
    })
  }

  async updateBoundModrinthProject(options: UpdateBoundModrinthProjectOptions) {
    requireObject(options)
    const metadata = await this.instanceService.getInstanceModpackMetadata(options.instancePath)
    if (!metadata || metadata.modrinth.projectId !== options.projectId) {
      throw new TypeError(`Modrinth project ${options.projectId} is not bound to this instance`)
    }
    await this.callAuthenticatedModrinth((client) => client.updateProject(options.projectId, options.project))
    if (options.iconPath) {
      const icon = new Blob([await readFile(options.iconPath)], { type: getImageMimeType(options.iconPath) })
      await this.callAuthenticatedModrinth((client) => client.updateProjectIcon(options.projectId, icon, extname(options.iconPath!)))
    }
    return await this.callAuthenticatedModrinth((client) => client.getProject(options.projectId))
  }

  private async requireBoundModrinthProject(instancePath: string, projectId: string) {
    const metadata = await this.instanceService.getInstanceModpackMetadata(instancePath)
    if (!metadata || metadata.modrinth.projectId !== projectId) throw new TypeError(`Modrinth project ${projectId} is not bound to this instance`)
    return await this.app.registry.get(ModrinthV2Client)
  }

  private async callAuthenticatedModrinth<T>(action: (client: ModrinthV2Client) => Promise<T>): Promise<T> {
    const client = await this.app.registry.get(ModrinthV2Client)
    try {
      return await action(client)
    } catch (error) {
      if (error instanceof ModerinthApiError && error.status === 401) {
        await (await this.app.registry.get(UserService)).loginModrinth(true)
        try {
          return await action(client)
        } catch (retryError) {
          this.throwModrinthApiError(retryError)
        }
      }
      this.throwModrinthApiError(error)
    }
  }

  private throwModrinthApiError(error: unknown): never {
    if (error instanceof ModerinthApiError) {
      let payload: { error?: string; description?: string } = {}
      try { payload = JSON.parse(error.body) } catch { }
      const description = payload.description || payload.error || error.message
      throw new AnyError('ModrinthApiError', description, { cause: error }, {
        status: error.status,
        description,
        error: payload.error,
        url: error.url,
      })
    }
    throw error
  }

  private async applyPendingModrinthProjectStatus(instancePath: string, projectId: string) {
    const metadata = await this.instanceService.getInstanceModpackMetadata(instancePath)
    const requestedStatus = metadata?.modrinth.pendingProjectStatus
    if (!metadata || !requestedStatus) return
    await this.callAuthenticatedModrinth((client) => client.updateProject(projectId, {
      requested_status: requestedStatus,
    }))
    await this.instanceService.setInstanceModpackMetadata(instancePath, {
      ...metadata,
      modrinth: {
        ...metadata.modrinth,
        pendingProjectStatus: undefined,
      },
    })
  }

  async addModrinthGalleryImage(options: AddModrinthGalleryImageOptions) {
    await this.requireBoundModrinthProject(options.instancePath, options.projectId)
    const image = new Blob([await readFile(options.imagePath)], { type: getImageMimeType(options.imagePath) })
    await this.callAuthenticatedModrinth((client) => client.addProjectGalleryImage(options.projectId, image, extname(options.imagePath), options))
    return await this.callAuthenticatedModrinth((client) => client.getProject(options.projectId))
  }

  async updateModrinthGalleryImage(instancePath: string, projectId: string, imageUrl: string, data: { featured?: boolean; title?: string; description?: string; ordering?: number }) {
    await this.requireBoundModrinthProject(instancePath, projectId)
    await this.callAuthenticatedModrinth((client) => client.updateProjectGalleryImage(projectId, imageUrl, data))
    return await this.callAuthenticatedModrinth((client) => client.getProject(projectId))
  }

  async deleteModrinthGalleryImage(instancePath: string, projectId: string, imageUrl: string) {
    await this.requireBoundModrinthProject(instancePath, projectId)
    await this.callAuthenticatedModrinth((client) => client.deleteProjectGalleryImage(projectId, imageUrl))
    return await this.callAuthenticatedModrinth((client) => client.getProject(projectId))
  }

  async publishModrinth(options: PublishModrinthOptions): Promise<PublishModrinthResult> {
    requireObject(options)
    const instance = this.instanceService.state.all[options.instancePath]
    if (!instance) {
      throw new TypeError(`Cannot publish unmanaged instance ${options.instancePath}`)
    }
    const privateFile = options.files.find((file) => isPrivateModrinthPath(file.path) || isPrivateModrinthPath(file.source || ''))
    if (privateFile) {
      throw new TypeError(`Sensitive file cannot be published: ${privateFile.path}`)
    }

    let projectId = 'id' in options.project ? options.project.id : ''
    const previousMetadata = await this.instanceService.getInstanceModpackMetadata(options.instancePath)
    if (!projectId && previousMetadata?.modrinth.projectId) {
      projectId = previousMetadata.modrinth.projectId
    }
    if (!projectId && 'create' in options.project) {
      const projectToCreate = options.project.create
      const icon = options.project.iconPath
        ? {
            fileName: basename(options.project.iconPath),
            data: new Blob([await readFile(options.project.iconPath)]),
          }
        : undefined
      const project = await this.callAuthenticatedModrinth((client) => client.createProject(projectToCreate, icon))
      projectId = project.id
      await this.instanceService.setInstanceModpackMetadata(options.instancePath, {
        ...(previousMetadata ?? {
          version: 0,
          exportDirectory: '',
          modpackVersion: options.version,
          emitCurseforge: false,
          emitModrinth: true,
          emitModrinthStrict: true,
          emitOffline: false,
          emittedFiles: options.files.map((file) => file.path),
          emittedServerFiles: [],
          filesEnvironments: {},
          modrinth: {
            projectId: '',
            profile: options.profile,
            versionType: options.release.version_type,
            pendingProjectStatus: undefined,
            lastVersionId: '',
            lastPublishedAt: 0,
            lastPublishedFiles: [],
            artifacts: [],
          },
        }),
        modrinth: {
          ...(previousMetadata?.modrinth ?? {
            profile: options.profile,
            versionType: options.release.version_type,
            pendingProjectStatus: undefined,
            lastVersionId: '',
            lastPublishedAt: 0,
            lastPublishedFiles: [],
            artifacts: [],
          }),
          projectId,
        },
      })
    }
    if (!projectId) {
      throw new TypeError('A Modrinth project id or project creation payload is required')
    }

    if ('id' in options.project) {
      const [user, members] = await this.callAuthenticatedModrinth((client) => Promise.all([
        client.getAuthenticatedUser(),
        client.getProjectTeamMembers(projectId),
      ]))
      const membership = members.find((member) => member.user.id === user.id && member.accepted)
      if (!membership || (membership.permissions & 1) === 0) {
        throw new TypeError(`Current Modrinth account cannot upload versions to project ${projectId}`)
      }
    }

    const existingVersions = await this.callAuthenticatedModrinth((client) => client.getProjectVersions(projectId))
    const existing = existingVersions.find((version) => version.version_number === options.release.version_number)
    if (existing) {
      if (previousMetadata?.modrinth.pendingProjectStatus && previousMetadata.modrinth.lastVersionId === existing.id) {
        await this.applyPendingModrinthProjectStatus(options.instancePath, projectId)
        return {
          projectId,
          versionId: existing.id,
          artifacts: previousMetadata.modrinth.artifacts,
        }
      }
      throw new TypeError(`Modrinth version ${options.release.version_number} already exists (${existing.id})`)
    }

    const archiveDirectory = join(
      options.destinationDirectory || this.app.host.getPath('downloads'),
      'modrinth',
      projectId,
      options.release.version_number,
    )
    await ensureDir(archiveDirectory)
    const profiles: Array<Exclude<ModrinthPackProfile, 'split'>> = options.profile === 'split'
      ? ['universal', 'client', 'server']
      : [options.profile]
    const artifacts: PublishModrinthResult['artifacts'] = []
    const selectedFiles = options.files.filter(file =>
      !isPrivateModrinthPath(file.path) && !isPrivateModrinthPath(file.source || ''),
    )

    for (const profile of profiles) {
      const files = getModrinthProfileFiles(selectedFiles, profile)
      const artifactName = profile === 'universal' ? options.name : `${options.name}-${profile}`
      const result = await this.exportModpack({
        ...options,
        files,
        name: artifactName,
        destinationDirectory: archiveDirectory,
        emitCurseforge: false,
        emitModrinth: true,
        emitOffline: false,
        showInFolder: false,
      })
      if (!result.modrinth) {
        throw new TypeError(`Failed to build ${profile} MRPack`)
      }
      artifacts.push({ profile, path: result.modrinth })
    }

    const uploadFiles: ModrinthUploadFile[] = await Promise.all(artifacts.map(async (artifact) => ({
      partName: artifact.profile,
      fileName: basename(artifact.path),
      data: new Blob([await readFile(artifact.path)]),
    })))
    const primaryFile = options.profile === 'client' ? 'client' : options.profile === 'server' ? 'server' : 'universal'
    const changelog = options.profile === 'split'
      ? `${options.release.changelog || ''}\n\nFiles:\n- ${options.name}-${options.version}.mrpack: universal client/server pack\n- ${options.name}-client-${options.version}.mrpack: client-only pack\n- ${options.name}-server-${options.version}.mrpack: dedicated-server-only pack`.trim()
      : options.release.changelog
    const version = await this.callAuthenticatedModrinth((client) => client.createVersion({
      ...options.release,
      changelog,
      project_id: projectId,
      status: 'draft',
    }, uploadFiles, primaryFile))

    const metadata = await this.instanceService.getInstanceModpackMetadata(options.instancePath)
    if (metadata) {
      await this.instanceService.setInstanceModpackMetadata(options.instancePath, {
        ...metadata,
        modpackVersion: options.version,
        modrinth: {
          projectId,
          profile: options.profile,
          versionType: options.release.version_type,
          pendingProjectStatus: metadata.modrinth.pendingProjectStatus,
          lastVersionId: version.id,
          lastPublishedAt: Date.now(),
          lastPublishedFiles: options.files.map((file) => file.path),
          artifacts,
        },
      })
      await this.applyPendingModrinthProjectStatus(options.instancePath, projectId)
    }
    this.app.shell.showItemInFolder(artifacts[0].path)
    return { projectId, versionId: version.id, artifacts }
  }

  async submitModrinthVersion(options: SubmitModrinthVersionOptions) {
    requireObject(options)
    await this.requireBoundModrinthProject(options.instancePath, options.projectId)
    await this.callAuthenticatedModrinth(async (client) => {
      const project = await client.getProject(options.projectId)
      const hasPublicationTarget = project.requested_status === 'approved' || project.requested_status === 'unlisted' || project.requested_status === 'private'
      if (project.status === 'draft' && !hasPublicationTarget) {
        await client.updateProject(options.projectId, { requested_status: 'approved' })
      }
      await client.updateVersion(options.versionId, { status: 'listed' })
    })
  }

  protected async getCachedInstallProfile(path: string) {
    const fStat = await stat(path)
    if (!fStat.isFile()) {
      throw new ModpackException(
        { type: 'requireModpackAFile', path },
        `Cannot import modpack ${path}, since it's not a file!`,
      )
    }

    const snapshot = await this.resourceManager.getSnapshotByIno(fStat.ino)
    const sha1 = snapshot?.sha1 ?? (await this.worker.checksum(path, 'sha1'))
    const metadata = await this.resourceManager.getMetadataByHash(sha1)

    if (metadata) {
      this.log(`Get modpack profile by cached ino ${path}`)
      const upstream: Instance['upstream'] = isValidCurseforgeRef(metadata.curseforge)
        ? {
            type: 'curseforge-modpack',
            modId: metadata.curseforge.projectId,
            fileId: metadata.curseforge.fileId,
            sha1,
          }
        : isValidModrinthRef(metadata.modrinth)
          ? {
              type: 'modrinth-modpack',
              projectId: metadata.modrinth.projectId,
              versionId: metadata.modrinth.versionId,
              sha1,
            }
          : undefined
      return {
        sha1,
        instance: metadata.instance ? transformInstance(metadata.instance) : undefined,
        upstream,
      }
    }

    return {
      sha1,
    }
  }

  async #processFiles<T>(
    handler: ModpackHandler,
    modpackFile: string,
    manifest: T,
    hash: string,
    entries: Entry[],
  ) {
    const instanceFiles = await handler.resolveInstanceFiles(manifest)
    this.log(`Discovered modpack profile ${modpackFile} with ${instanceFiles.length} files`)

    const files = entries
      .filter((e) => !!handler.resolveUnpackPath(manifest, e) && !e.fileName.endsWith('/'))
      .map((e) => {
        const relativePath = handler.resolveUnpackPath(manifest, e)!
        const file: InstanceFile = {
          path: relativePath,
          size: e.uncompressedSize,
          hashes: {
            crc32: e.crc32.toString(),
          },
          downloads: [
            `zip:///${modpackFile}?entry=${encodeURIComponent(e.fileName)}`,
            `zip://${hash}/${e.fileName}`,
          ],
        }
        return file
      })
      .concat(instanceFiles)
      .filter((f) => !f.path.endsWith('/'))

    for (const file of files) {
      transformFile(file)
    }

    return files
  }

  async openModpack(modpackFile: string): Promise<SharedState<ModpackState>> {
    if (typeof modpackFile !== 'string' || modpackFile.length === 0) {
      throw new ModpackException({ type: 'invalidModpack', path: '' })
    }
    const store = await this.app.registry.get(ServiceStateManager)
    const zipManager = await this.app.registry.getOrCreate(ZipManager)

    this.log(`Open modpack profile ${modpackFile}`)
    return store.registerOrGet(`modpack-file://${modpackFile}`, async () => {
      const cached = await this.getCachedInstallProfile(modpackFile)
      const zip = await zipManager.open(modpackFile).catch((e) => {
        // User dragged in a non-zip (.rar, .7z, corrupted download).
        // Convert to a UI-friendly Exception so it doesn't pollute
        // telemetry (issue #1469 — 79 users in 0.56.4, ~all .rar /
        // .rar.zip / corrupted Forge installers).
        if (e?.name === 'InvalidZipFile' || e?.name === 'InvalidZipFileError') {
          throw new ModpackException({ type: 'invalidModpack', path: modpackFile }, undefined, { cause: e })
        }
        throw e
      })
      this.log(`Opened modpack profile ${modpackFile}`)
      const state = new ModpackState()
      state.modpackPath = modpackFile

      const hash = cached.sha1

      const entries = Object.values(zip.entries)
      const [manifest, handler, errors] = await this.getManifestAndHandler(zip.file, entries)
      if (!manifest || !handler) {
        for (const e of errors) {
          this.error(
            Object.assign(e, { name: e.name || 'ModpackParseError', cause: 'ModpackParsing' }),
          )
        }
        state.error = new ModpackException({ type: 'invalidModpack', path: modpackFile })
        return [state, zip.dispose]
      }

      this.log(`Parse modpack profile ${modpackFile} with handler ${handler.constructor.name}`)
      const instance = handler.resolveInstanceOptions(manifest)

      let mmcVersionId: string | undefined
      if (isMMCModpackManifest(manifest)) {
        mmcVersionId = await this.#applyMmcStandaloneVersion(manifest, zip.file, entries, instance.name)
          .catch((e) => {
            this.warn(new AnyError('OpenModpackError', `Failed to apply MultiMC patches: ${e}`))
            return undefined
          })
      }

      let xmclCache: SelectedXMCLFields | undefined
      if (zip.entries['xmcl.json']) {
        try {
          const b = await readEntry(zip.file, zip.entries['xmcl.json'])
          xmclCache = JSON.parse(b.toString()) as SelectedXMCLFields
        } catch {}
      }

      state.config = {
        ...instance,
        ...xmclCache,
        upstream: cached.upstream,
        ...(mmcVersionId ? { version: mmcVersionId } : {}),
      }

      if (typeof cached === 'object' && cached.instance) {
        this.log(`Use cached modpack profile ${modpackFile}`)
        // The cached files embed an absolute `zip:///<path>?entry=...` download
        // URL pointing at the modpack location at cache time. The cache is keyed
        // by file hash, so if the same file content is later opened from a
        // different path (e.g. the user moved it into a subfolder), the stale
        // path no longer exists and the unzip fails with ENOENT ("modpack file
        // not found"). Re-point the absolute zip URL at the current modpackFile.
        state.files = cached.instance.files.map((f) => remapModpackZipDownloads(f, modpackFile))
        state.ready = true
        return [state, zip.dispose]
      }

      // Update the market metadata
      if (!cached.upstream) {
        this.log(`Update modpack market metadata ${modpackFile}`)
        handler
          .resolveModpackMarketMetadata?.(modpackFile, hash)
          .then((metadata) =>
            this.resourceManager.updateMetadata([
              {
                hash,
                metadata: {
                  ...metadata,
                },
              },
            ]),
          )
          .catch((e) => {
            this.error(
              new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }),
            )
          })
      }

      this.#processFiles(handler, modpackFile, manifest, hash, entries)
        .then((files) => {
          state.modpackFiles(files)
          this.log(`Update instance resource modpack profile ${modpackFile}`)
          // cache the manifest
          return this.resourceManager.updateMetadata([
            {
              hash,
              metadata: {
                instance: {
                  instance,
                  files,
                },
              },
            },
          ])
        })
        .catch((e) => {
          this.error(
            new AnyError('ModpackInstallProfileError', 'Fail to update resource', { cause: e }),
          )
          state.modpackError(e)
        })

      return [state, zip.dispose]
    })
  }

  /**
   * Bake the merged Prism / MultiMC `patches/*.json` into a standalone version
   * json under `versions/<id>/<id>.json`, copy the bundled `MMC-hint: "local"`
   * libraries into the shared `libraries/` folder, and register the version.
   *
   * @returns the pinned version id, or `undefined` when the pack has no launch
   * overrides (in which case the normal runtime-based install path is used).
   */
  async #applyMmcStandaloneVersion(
    manifest: MMCModpackManifest,
    zip: YauzlZipFile,
    entries: Entry[],
    name: string,
  ): Promise<string | undefined> {
    const versionId = filenamify(name || '').trim()
    if (!versionId) return undefined

    const version = getMmcVersionFromManifest(manifest, versionId)
    if (!version) return undefined

    const jsonPath = this.getPath('versions', versionId, `${versionId}.json`)
    await ensureFile(jsonPath)
    await writeFile(jsonPath, JSON.stringify(version, null, 2))

    const localLibraries = getMmcLocalLibraryNames(version)
    if (localLibraries.length) {
      // Copy the bundled local libraries into the shared libraries folder by
      // their maven path so the version resolver can find them on the classpath.
      const prefix = manifest.prefix ?? ''
      // Prism / MultiMC store bundled local libraries flat as
      // `<prefix>libraries/<jar-filename>`, so the exact-path lookup below is
      // deterministic; the linear fallback only covers non-standard layouts.
      const byName = new Map(entries.map((e) => [e.fileName, e] as const))
      for (const libName of localLibraries) {
        const info = LibraryInfo.resolve(libName)
        const fileName = basename(info.path)
        const entry =
          byName.get(`${prefix}libraries/${fileName}`) ??
          entries.find(
            (e) =>
              e.fileName.startsWith(prefix) &&
              (e.fileName.endsWith(`/libraries/${fileName}`) || e.fileName.endsWith(`/${fileName}`)),
          )
        if (!entry) {
          this.warn(`Cannot find local library ${libName} (${fileName}) in the MultiMC modpack`)
          continue
        }
        const dest = this.getPath('libraries', ...info.path.split('/'))
        await ensureFile(dest)
        await writeFile(dest, await readEntry(zip, entry))
      }
    }

    const versionService = await this.app.registry.get(VersionService)
    await versionService.refreshVersion(versionId).catch((e) => this.warn(e))

    return versionId
  }

  private async getManifestAndHandler(zip: YauzlZipFile, entries: Entry[]) {
    const errors = [] as any[]
    for (const handler of Object.values(this.handlers)) {
      const manifest = await handler.readManifest(zip, entries).catch((e) => {
        errors.push(e)
        return undefined
      })
      if (manifest) {
        return [manifest, handler, []] as const
      }
    }
    return [undefined, undefined, errors] as const
  }

  async showModpacksFolder(): Promise<void> {
    this.app.shell.openDirectory(this.getPath('modpacks'))
  }

  async watchModpackFolder(): Promise<SharedState<ResourceState>> {
    throw new Error('')
    // const states = await this.app.registry.getOrCreate(ServiceStateManager)
    // return states.registerOrGet('modpacks', async ({ doAsyncOperation }) => {
    //   const dir = this.getPath('modpacks')
    //   await ensureDir(dir)
    //   const { dispose, revalidate, state } = this.resourceManager.watch({
    //     directory: dir,
    //     domain: ResourceDomain.Modpacks,
    //     processUpdate: (func) => doAsyncOperation(func()),
    //   })
    //   return [state, dispose, revalidate]
    // })
  }

  async removeModpack(path: string): Promise<void> {
    const dir = dirname(path)
    const modpacksFolder = this.getPath('modpacks')
    if (dir !== modpacksFolder) {
      return
    }
    await unlink(path)
  }
}
