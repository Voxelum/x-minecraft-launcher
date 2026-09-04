import { isMissingVersionJsonError, MinecraftFolder, ResolvedVersion, Version, type JavaVersion } from '@xmcl/core'
import {
  AnyTracker,
  AssetsOptions,
  AssetsTrackerEvents,
  createFabricInstallWorkflow,
  createLabyModInstallWorkflow,
  createLegacyForgeInstallWorkflow,
  createModernForgeInstallWorkflow,
  createProfileInstallWorkflow,
  createQuiltInstallWorkflow,
  DEFAULT_FORGE_MAVEN,
  DEFAULT_META_URL_FABRIC,
  DEFAULT_META_URL_QUILT,
  DEFAULT_RESOURCE_ROOT_URL,
  diagnoseInstallation,
  diagnoseServerInstallation,
  InstallError,
  JarOption,
  LibrariesTrackerEvents,
  LibraryOptions,
  onDownloadMultiple,
  resolveAssetInstallFiles,
  resolveAssetMetadataInstallManifest,
  resolveAssetObjectInstallFiles,
  resolveForgeArtifactVersion,
  resolveForgeInstallerFile,
  resolveLibraryInstallFiles,
  resolveMinecraftJarInstallFile,
  resolveMinecraftVersionJsonInstallFile,
  resolveNeoForgedInstallerFile,
  resolveOptifineInstallManifest,
  resolveVersionInstallManifest,
  resolveVersionRepairManifest,
  runInstallWorkflow,
  Tracker,
  type ForgeProcessorResolution,
  type ForgeTrackerEvents,
  type InstallFile,
  type InstallForgeOptions,
  type InstallIssue,
  type InstallManifest,
  type InstallTask,
  type InstallWorkflow,
  type MinecraftTrackerEvents,
  type PostProcessor,
  type ProgressTrackerMultiple,
  type VersionInstallManifest,
} from '@xmcl/installer'
import {
  DiagnoseOptions,
  findMatchedVersion,
  getResolvedVersionHeader,
  InstallAssetsTask,
  InstallFabricTask,
  InstallForgeTask,
  InstallJavaTask,
  InstallLabyModTask,
  InstallLibrariesTask,
  InstallMinecraftTask,
  InstallNeoForgeTask,
  InstallOptifineTask,
  InstallProfileTask,
  InstallQuiltTask,
  isFabricLoaderLibrary,
  isForgeLibrary,
  LockKey,
  MarkVersionInstallationOptions,
  parseOptifineVersion,
  Settings,
  Task,
  type InstallLabyModOptions,
  type InstallOptifineAsModOptions,
  type InstallOptifineOptions,
  type InstallProfileOptions,
  type OptifineVersion,
  type SharedState,
  type VersionInstallRequest,
} from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { AsyncLocalStorage } from 'async_hooks'
import { spawn } from 'child_process'
import { readFile } from 'fs-extra'
import { join } from 'path'
import { Inject, kGameDataPath, LauncherApp, LauncherAppKey, type PathResolver } from '~/app'
import { GFW, kGFW, kTasks, TaskInstance, Tasks } from '~/infra'
import { InstanceService } from '~/instance'
import { JavaService } from '~/java'
import { VersionService } from '~/launch'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { joinUrl, replaceHost } from '~/util/url'
import { kOptifineInstaller } from './optifine'
import { applyJavaInstallManifest, resolveLauncherJavaInstallManifest } from '~/java/JavaInstall'
import { kResourceWorker, ResourceWorker } from '~/resource'
import { getTracker } from '~/util/taskHelper'
import { InstallManifestService } from './InstallManifestService'
import { FreshResultCache, InFlightCache } from './DiagnosisCache'
import { reinstallDiagnoseOptions } from './reinstallPolicy'
// @ts-ignore
import clazData from './utils/MultiJarLauncher.class'
import { VersionMetadataService } from './VersionMetadataService'
import { selectLocalVersion } from './versionSelection'

const DIAGNOSIS_FRESHNESS_MS = 30_000

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export class InstallCoordinator {
  private installContext = new AsyncLocalStorage<{
    timings: Array<{ task: string; type: InstallTask['type']; startedAt: number; duration: number }>
  }>()
  private readonly diagnosisCache = new FreshResultCache<InstallIssue | undefined>(DIAGNOSIS_FRESHNESS_MS)
  private readonly diagnosisChecksums = new InFlightCache<string>()
  private readonly logger

  constructor(
    @Inject(LauncherAppKey) private readonly app: LauncherApp,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(VersionMetadataService) private versionMetadataService: VersionMetadataService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kGFW) private gfw: GFW,
    @Inject(kSettings) private settings: SharedState<Settings>,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kResourceWorker) private resourceWorker: ResourceWorker,
    @Inject(InstallManifestService) private manifestInstaller: InstallManifestService,
  ) {
    this.logger = app.getLogger('InstallCoordinator')
  }

  private runForgeInstall<T>(minecraft: string, action: () => Promise<T>) {
    return this.app.mutex.of(LockKey.forgePostProcess(minecraft)).runExclusive(action)
  }

  private ensureJava(target: JavaVersion, forceZulu = false) {
    return this.app.mutex
      .of(`java/${target.component}/${forceZulu}`)
      .runExclusive(() => this.applyJavaInstall(target, forceZulu))
  }

  private async applyJavaInstall(target: JavaVersion, forceZulu = false) {
    const manifest = await resolveLauncherJavaInstallManifest(
      this.app,
      this.getPath,
      target,
      forceZulu,
    )
    const task = this.tasks.create<InstallJavaTask>({
      type: 'installJre',
      key: `java-${target.majorVersion}-${target.component}`,
      version: target.majorVersion,
    })
    try {
      const result = await applyJavaInstallManifest(
        this.app,
        this.manifestInstaller,
        task,
        manifest,
        (path) => this.javaService.resolveJava(path),
      )
      task.complete()
      return result
    } catch (error) {
      task.fail(error)
      this.logger.error(error as any)
      throw error
    }
  }

  protected createFetchWithFallback(
    apiSets: string[],
    preferDefault: boolean,
    metaPath: string,
  ): (url: string, init?: RequestInit) => Promise<Response> {
    return (i, init) => {
      const url = new URL(i)
      // When mirrors must NOT be used (official preference, or "auto"
      // outside the GFW), ignore the configured api-sets entirely so we
      // never touch a third-party mirror — even as a parallel fallback.
      const apis = (preferDefault ? apiSets : []).map((a) => a + metaPath)
      if (preferDefault) {
        apis.unshift(url.protocol + '//' + url.host)
      } else {
        apis.push(url.protocol + '//' + url.host)
      }
      const urls = apis
        .map((a) => new URL(a))
        .map((a) => {
          const realUrl = new URL(url.toString())
          realUrl.host = a.host
          realUrl.pathname = (a.pathname === '/' ? '' : a.pathname) + url.pathname
          return realUrl.toString()
        })
      return Promise.any(
        urls.map(async (a) => {
          const resp = await this.app.fetch(a, init)
          if (resp.ok) {
            return resp
          }
          throw new Error(`Failed to fetch ${a}`)
        }),
      )
    }
  }

  protected getInstallOptions(
    overrides: {
      side?: 'client' | 'server'
      java?: string
      inheritsFrom?: string
      timestamp?: number
      fetch?: (url: string, init?: RequestInit) => Promise<Response>
    },
    task: TaskInstance<Task>,
  ) {
    const tracker: AnyTracker | undefined = getTracker(task)
    const options: LibraryOptions & AssetsOptions & InstallForgeOptions & JarOption = {
      useHashForAssetsIndex: true,
      tracker,
      fetch: overrides.fetch ?? (this.app.fetch as any),
      ...overrides,
      signal: task.controller.signal,
      checksum: (file, algorithm) => this.resourceWorker.checksum(file, algorithm),
    }

    const allSets = getApiSets(this.settings)

    if (shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      // `getApiSets` already puts the preferred (e.g. bmcl) set first.
      // The adaptive controller drops slow mirror assignments and
      // re-requests the signed API for a faster one, so the previous
      // "list bmcl three extra times" fallback trick is no longer
      // needed. Official is kept as the final hard-failure fallback.
      allSets.push({ name: 'mojang', url: '' })
    } else {
      // Official / non-bmcl users must never touch third-party mirrors,
      // even as a fallback — download straight from the official source.
      allSets.length = 0
      allSets.push({ name: 'mojang', url: '' })
    }

    options.assetsHost = allSets.map((api) =>
      api.url ? `${api.url}/assets` : DEFAULT_RESOURCE_ROOT_URL,
    )
    options.libraryHost = (lib) => {
      const urls = allSets.map((api) => {
        if (api.url) {
          return joinUrl(`${api.url}/maven`, lib.download.path)
        }
        return lib.download.url
      })
      if (lib.name.includes('forge')) {
        urls.push(joinUrl(DEFAULT_FORGE_MAVEN, lib.download.path))
      }
      const keywords = ['mojang', 'minecraft', 'forge', 'fabric', 'optifine']
      let shouldAppendCommonMaven = true
      for (const keyword of keywords) {
        if (lib.name.includes(keyword)) {
          shouldAppendCommonMaven = false
          break
        }
      }
      if (shouldAppendCommonMaven) {
        urls.push(joinUrl(DEFAULT_FORGE_MAVEN, lib.download.path))
      }
      return urls
    }
    options.assetsIndexUrl = (ver) =>
      allSets
        .map((api) => {
          if (ver.assetIndex) {
            if (api.name === 'mojang') {
              return ver.assetIndex.url
            }
            return replaceHost(ver.assetIndex.url, api.url)
          }
          return ''
        })
        .filter((v) => !!v)

    options.json = (ver) =>
      allSets.map((api) => {
        if (api.name === 'mojang') {
          return ver.url
        }
        return replaceHost(ver.url, api.url)
      })

    options.client = (ver) =>
      allSets
        .map((api) => {
          if (ver.downloads.client) {
            if (api.name === 'mojang') {
              return ver.downloads.client.url
            }
            return replaceHost(ver.downloads.client.url, api.url)
          }
          return ''
        })
        .filter((v) => !!v)

    // forge
    options.mavenHost = allSets.map((api) => (api.url ? `${api.url}/maven` : DEFAULT_FORGE_MAVEN))
    options.java = overrides.java || this.javaService.getPreferredJava()?.path || ''
    options.spawn = (cmd, args, opts) => {
      const a = args ? [...args] : []
      if (this.settings.httpProxy && this.settings.httpProxyEnabled) {
        const parsed = new URL(this.settings.httpProxy)
        if (parsed.hostname && parsed.port) {
          a.unshift(
            `-Dhttp.proxyHost=${parsed.hostname}`,
            `-Dhttp.proxyPort=${parsed.port}`,
            `-Dhttps.proxyHost=${parsed.hostname}`,
            `-Dhttps.proxyPort=${parsed.port}`,
          )
        } else {
          // use system proxy
          a.unshift('-Djava.net.useSystemProxies=true')
        }
      }
      return spawn(cmd, a, opts || {})
    }
    return options
  }

  private executePrimitivePlan(
    plan: InstallManifest,
    options: LibraryOptions & AssetsOptions & InstallForgeOptions & JarOption,
    tracker?: ProgressTrackerMultiple,
  ) {
    return this.manifestInstaller
      .install(plan, {
        signal: options.signal,
        tracker,
      })
      .then((result) => {
        this.installContext.getStore()?.timings.push(...result.timings)
        return result
      })
  }

  private async runWorkflow<T>(
    workflow: InstallWorkflow<T>,
    options: LibraryOptions & AssetsOptions & InstallForgeOptions & JarOption,
    tracker?: ProgressTrackerMultiple | ((plan: InstallManifest, stage: number) => ProgressTrackerMultiple | undefined),
  ) {
    return runInstallWorkflow(workflow, async (plan, stage) => {
      const result = await this.manifestInstaller.install(plan, {
        signal: options.signal,
        tracker: typeof tracker === 'function' ? tracker(plan, stage) : tracker,
      })
      this.installContext.getStore()?.timings.push(...result.timings)
    })
  }

  private async getOptifineDownloadUrl(version: OptifineVersion) {
    const installer = await this.app.registry.getIfPresent(kOptifineInstaller)
    if (installer) {
      return installer(version)
    }
    // OptiFine is served only from BMCLAPI. Respect the user's api-set
    // preference: official / outside-GFW users must not touch the mirror.
    if (!shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      throw new AnyError(
        'OptifineNoMirrorError',
        'OptiFine can only be downloaded from the BMCLAPI mirror, which is disabled by your API source preference.',
      )
    }
    return `https://bmclapi2.bangbang93.com/optifine/${version.mcversion}/${version.type}/${version.patch}`
  }

  private async applyOptifineModPlan(options: InstallOptifineAsModOptions) {
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(
      `/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`,
    )
    const url = await this.getOptifineDownloadUrl(options)
    this.logger.log(`Install OptiFine ${optifineVersion} as mod for ${options.mcversion}`)
    const task = this.tasks.create<InstallOptifineTask>({
      type: 'installOptifine',
      key: `${options.mcversion}-optifine-mod${options.type}_${options.patch}`,
      version: optifineVersion,
      minecraft: options.mcversion,
    })
    const installOptions = this.getInstallOptions({ side: 'client' }, task)
    const destination = join(options.instancePath, 'mods', `OptiFine-${version}.jar`)
    try {
      await this.executePrimitivePlan(
        {
          schemaVersion: 1,
          tasks: [
            {
              id: 'optifine-mod-file',
              type: 'files',
              files: [{ path, urls: [url], validator: 'zip' }],
            },
            {
              id: 'optifine-mod-copy',
              type: 'materialize',
              operations: [{ type: 'copy', source: path, path: destination }],
              outputs: [{ path: destination, validator: 'zip' }],
              dependsOn: ['optifine-mod-file'],
            },
          ],
        },
        installOptions,
        onDownloadMultiple(installOptions.tracker as Tracker<LibrariesTrackerEvents>, 'libraries', {
          count: 1,
        }),
      )
      task.complete()
      this.logger.log(`Successfully installed OptiFine ${optifineVersion} as mod for ${options.mcversion}`)
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private applyOptifinePlan(options: InstallOptifineOptions) {
    return this.app.mutex
      .of(LockKey.version(`optifine-${options.mcversion}-${options.type}_${options.patch}`))
      .runExclusive(() => this.applyOptifinePlanUnlocked(options))
  }

  private async applyOptifinePlanUnlocked(options: InstallOptifineOptions) {
    const minecraft = new MinecraftFolder(this.getPath())
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(
      `/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`,
    )
    this.logger.log(`Install optifine ${version} on ${options.inheritFrom ?? options.mcversion}`)

    let installFromForge = false
    if (options.inheritFrom === options.mcversion) {
      options.inheritFrom = undefined
    }

    if (options.inheritFrom) {
      const from = await Version.parse(minecraft, options.inheritFrom)
      if (from.libraries.some(isForgeLibrary)) {
        installFromForge = true
        // install over forge
      } else if (from.libraries.some(isFabricLoaderLibrary)) {
        this.logger.warn('Installing optifine over a fabric! This might not work!')
      }
    }

    const java = options.java ?? this.javaService.getPreferredJava()?.path
    const url = await this.getOptifineDownloadUrl(options)

    const task = this.tasks.create<InstallOptifineTask>({
      type: 'installOptifine',
      key: `${options.mcversion}-optifine${options.type}_${options.patch}`,
      version: `${options.type}_${options.patch}`,
      minecraft: options.mcversion,
    })
    const ops = this.getInstallOptions(
      { side: 'client', java, inheritsFrom: options.inheritFrom },
      task,
    )

    try {
      const tracker = onDownloadMultiple(
        ops.tracker as Tracker<LibrariesTrackerEvents>,
        'libraries',
        { count: 1 },
      )
      await this.executePrimitivePlan(
        {
          schemaVersion: 1,
          tasks: [
            {
              id: 'optifine-installer',
              type: 'files',
              files: [{ path, urls: [url], validator: 'zip' }],
            },
          ],
        },
        ops,
        tracker,
      )

      const compiled = await resolveOptifineInstallManifest(path, minecraft, ops)
      await this.executePrimitivePlan(compiled.plan, ops)
      let id = compiled.version

      if (options.inheritFrom) {
        const parentJson: Version = JSON.parse(
          await readFile(minecraft.getVersionJson(options.inheritFrom), 'utf8'),
        )
        const json: Version = JSON.parse(await readFile(minecraft.getVersionJson(id), 'utf8'))
        json.inheritsFrom = options.inheritFrom
        json.id = `${options.inheritFrom}-Optifine-${version}`
        if (installFromForge) {
          json.arguments!.game = ['--tweakClass', 'optifine.OptiFineForgeTweaker']
          json.mainClass = parentJson.mainClass
        }
        const dest = minecraft.getVersionJson(json.id)
        await this.executePrimitivePlan(
          {
            schemaVersion: 1,
            tasks: [
              {
                id: 'optifine-inherited-version',
                type: 'materialize',
                operations: [{ type: 'write', path: dest, content: JSON.stringify(json, null, 4) }],
                outputs: [{ path: dest, validator: 'json' }],
              },
            ],
          },
          ops,
        )
        id = json.id
      }

      this.logger.log(
        `Succeed to install optifine ${version} on ${options.inheritFrom ?? options.mcversion}. ${id}`,
      )

      task.complete()
      return id
    } catch (e) {
      task.fail(e)
      throw e
    }
  }

  private async markVersionInstallation(options: MarkVersionInstallationOptions) {
    const folder = MinecraftFolder.from(this.getPath())
    const lockPath = join(folder.getVersionRoot(options.version), '.install-lock')
    const result = await this.manifestInstaller.install({
      schemaVersion: 1,
      tasks: [
        {
          id: 'version-install-lock',
          type: 'materialize',
          operations: [
            {
              type: 'write',
              path: lockPath,
              content: JSON.stringify({
                schemaVersion: 1,
                version: options.version,
                timestamp: options.timestamp,
              }),
            },
          ],
          outputs: [{ path: lockPath, validator: 'json' }],
        },
      ],
    })
    this.installContext.getStore()?.timings.push(...result.timings)
  }

  async install(request: VersionInstallRequest) {
    if (request.type === 'java') {
      return this.ensureJava(request.target, request.forceZulu)
    }
    this.invalidateDiagnosis()
    try {
      if (request.type === 'instance') {
        return await this.app.mutex
          .of(LockKey.instanceVersion(request.instancePath))
          .runExclusive(() => this.installInstanceRequest(request))
      }
      if (request.type === 'repair') {
        return await this.app.mutex
          .of(LockKey.version(request.version))
          .runExclusive(() => this.repairVersion(request.version, request.side))
      }
      if (request.type === 'reinstall') {
        return await this.app.mutex
          .of(LockKey.version(request.version))
          .runExclusive(() => this.reinstallVersion(request.version, request.side ?? 'client'))
      }
      if (request.type === 'optifine-mod') {
        return await this.applyOptifineModPlan(request.options)
      }

      return await this.app.mutex
        .of(LockKey.instance(request.path))
        .runExclusive(() => this.applyServerRecipe(request))
    } finally {
      this.invalidateDiagnosis()
    }
  }

  private async installInstanceRequest(
    request: Extract<VersionInstallRequest, { type: 'instance' }>,
  ) {
    const runtime = request.runtime
    const local = selectLocalVersion(
      this.versionService.state.local,
      runtime,
      request.selectedVersion,
    )
    if (local) {
      try {
        const resolved = await this.versionService.resolveLocalVersion(local.id)
        const issue = await this.diagnoseClientVersion(resolved)
        if (!issue) {
          return {
            version: local.id,
            timestamp: Date.now(),
            duration: 0,
            timings: [],
          }
        }
        return this.applyInstanceVersionRecipe(
          resolveVersionRepairManifest({
            runtime,
            resolvedVersion: local.id,
            issue,
            preferredJava: this.instanceService.state.all[request.instancePath]?.java,
          }),
        )
      } catch (error) {
        if (!isMissingVersionJsonError(error)) throw error
        this.versionService.state.localVersionRemove(local.id)
      }
    }

    const recipe = await resolveVersionInstallManifest(
      {
        runtime,
        preferredJava: this.instanceService.state.all[request.instancePath]?.java,
      },
      {
        getMinecraftVersion: async (minecraft) => {
          const list = await this.versionMetadataService.getMinecraftVersions()
          return list.versions.find((version) => version.id === minecraft)
        },
        findLocalVersion: async (requested) => {
          const version = findMatchedVersion(this.versionService.state.local, '', requested)
          return version && { id: version.id }
        },
        getForgeVersion: async (minecraft, forge) => {
          const versions = await this.versionMetadataService.getForgeVersions(minecraft)
          return versions.find((version) => version.version === forge)
        },
        getNeoForgedVersion: async (minecraft, neoForged) => {
          const versions = await this.versionMetadataService.getNeoForgedVersions(minecraft)
          return versions.find((version) => version === neoForged)
        },
        getLabyModManifest: () => this.versionMetadataService.getLabyModManifest(),
      },
    )
    return this.applyInstanceVersionRecipe(recipe)
  }

  private async applyServerRecipe(request: Extract<VersionInstallRequest, { type: 'server' }>) {
    const runtime = request.runtime
    const minecraft = runtime.minecraft
    const type = runtime.forge
      ? 'forge'
      : runtime.neoForged
        ? 'neoforge'
        : runtime.fabricLoader
          ? 'fabric'
          : runtime.quiltLoader
            ? 'quilt'
            : 'vanilla'
    const loader = runtime.forge || runtime.neoForged || runtime.fabricLoader || runtime.quiltLoader
    const existed = this.versionService.state.servers.find(
      (version) =>
        version.type === type &&
        version.minecraft === minecraft &&
        (type === 'vanilla' || version.version === loader),
    )
    if (existed) {
      const issue = await this.diagnose({ version: existed.id, side: 'server' })
      if (!issue) return existed.id
      await this.repairVersion(existed.id, 'server', issue)
      return existed.id
    }
    const minecraftVersions = await this.versionMetadataService.getMinecraftVersions()
    const minecraftMetadata = minecraftVersions.versions.find((version) => version.id === minecraft)
    if (!minecraftMetadata) throw new Error(`Cannot find Minecraft metadata for ${minecraft}`)
    const forge = runtime.forge
      ? (await this.versionMetadataService.getForgeVersions(minecraft)).find(
          (version) => version.version === runtime.forge,
        )
      : undefined
    const folder = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallMinecraftTask>({
      type: 'installVersion',
      key: `server:${minecraft}`,
      version: minecraft,
    })
    const options = this.getInstallOptions({ side: 'server' }, task)
    try {
      let resolved = await this.versionService.resolveLocalVersion(minecraft).catch(() => undefined)
      if (!resolved) {
        await this.executePrimitivePlan(
          {
            schemaVersion: 1,
            tasks: [
              {
                id: 'server-version-json',
                type: 'files',
                files: [resolveMinecraftVersionJsonInstallFile(minecraftMetadata, folder, options)],
              },
            ],
          },
          options,
        )
        resolved = await this.versionService.resolveLocalVersion(minecraft)
      }
      const files = resolveLibraryInstallFiles(resolved.libraries, folder, options)
      const jar = resolveMinecraftJarInstallFile(resolved, { ...options, side: 'server' })
      if (jar) files.push(jar)
      await this.executePrimitivePlan(
        {
          schemaVersion: 1,
          tasks: [{ id: 'server-base-files', type: 'files', files }],
        },
        options,
      )

      let version = minecraft
      if (runtime.forge || runtime.neoForged) {
        const matched = this.javaService.state.all.find(
          (java) => java.valid && java.majorVersion === resolved!.javaVersion.majorVersion,
        )
        const java =
          matched?.path ?? (await this.ensureJava(resolved.javaVersion).then((value) => value.path))
        if (!java) {
          throw new AnyError('InvalidJava', `Cannot resolve Java for ${minecraft}`)
        }
        version = await this.applyModernForgeWorkflow({
          type: runtime.forge ? 'forge' : 'neoforge',
          minecraft,
          version: runtime.forge || runtime.neoForged,
          installer: forge?.installer,
          java,
          side: 'server',
        })
      } else if (runtime.fabricLoader) {
        version = await this.applyFabricRecipe(minecraft, runtime.fabricLoader, undefined, 'server')
      } else if (runtime.quiltLoader) {
        version = await this.applyQuiltRecipe(minecraft, runtime.quiltLoader, undefined, 'server')
      }
      await this.versionService.refreshServerVersion(version)
      task.complete()
      return version
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async repairVersion(
    version: string,
    side: 'client' | 'server',
    knownIssue?: InstallError['issue'],
  ) {
    if (side === 'client') {
      const resolved = await this.versionService.resolveLocalVersion(version)
      const issue = knownIssue ?? (await this.diagnoseClientVersion(resolved))
      if (!issue) return
      const header = getResolvedVersionHeader(resolved)
      await this.applyInstanceVersionRecipe(
        resolveVersionRepairManifest({
          runtime: {
            minecraft: header.minecraft,
            forge: header.forge,
            neoForged: header.neoForged,
            fabricLoader: header.fabric,
            quiltLoader: header.quilt,
            optifine: header.optifine,
            labyMod: header.labyMod,
          },
          resolvedVersion: version,
          issue,
        }),
      )
      return
    }

    const folder = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallLibrariesTask>({
      type: 'installLibraries',
      key: `repair:${side}:${version}`,
    })
    const options = this.getInstallOptions({ side }, task)
    try {
      const server = await this.versionService.resolveServerVersion(version)
      const resolved = await this.versionService.resolveLocalVersion(server.minecraftVersion)
      const issue = knownIssue ?? (await this.diagnose({ version, side: 'server' }))
      if (!issue) {
        task.complete()
        return
      }
      const files: InstallFile[] = []
      if (issue.jar) {
        const jar = resolveMinecraftJarInstallFile(resolved, { ...options, side: 'server' })
        if (jar) files.push(jar)
      }
      if (issue.libraries?.length) {
        files.push(...resolveLibraryInstallFiles(issue.libraries, folder, options))
      }
      const tasks: InstallTask[] = [{ id: 'repair-version-files', type: 'files', files }]
      await this.executePrimitivePlan({ schemaVersion: 1, tasks }, options)
      if (issue.profile) {
        const matched = this.javaService.state.all.find(
          (java) => java.valid && java.majorVersion === resolved.javaVersion.majorVersion,
        )
        const java =
          matched?.path ?? (await this.ensureJava(resolved.javaVersion).then((value) => value.path))
        if (!java)
          throw new AnyError('InvalidJava', `Cannot resolve Java for ${server.minecraftVersion}`)
        await this.applyProfileWorkflow(issue.profile, java, 'server')
      }
      await this.markVersionInstallation({ version, timestamp: Date.now() })
      task.complete()
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async reinstallVersion(version: string, side: 'client' | 'server') {
    if (side === 'client') {
      const resolved = await this.versionService.resolveLocalVersion(version)
      const issue = await this.diagnoseClientVersion(resolved, reinstallDiagnoseOptions)
      if (issue) await this.repairVersion(version, side, issue)
      return
    }

    const server = await this.versionService.resolveServerVersion(version)
    const base = await this.versionService.resolveLocalVersion(server.minecraftVersion)
    const issue = await diagnoseServerInstallation(
      server,
      MinecraftFolder.from(this.getPath()),
      base,
      {
        ...reinstallDiagnoseOptions,
        checksum: (file, algorithm) => this.resourceWorker.checksum(file, algorithm),
      },
    )
    if (issue) await this.repairVersion(version, side, issue)
  }

  private async applyFabricRecipe(
    minecraft: string,
    loader: string,
    base?: string,
    side: 'client' | 'server' = 'client',
  ) {
    const task = this.tasks.create<InstallFabricTask>({
      type: 'installFabric',
      key: `${minecraft}-fabric${loader}`,
      loader,
      minecraft,
    })
    const options = this.getInstallOptions(
      {
        side,
        inheritsFrom: base,
      },
      task,
    )
    try {
      const profilePath =
        side === 'client'
          ? `/v2/versions/loader/${minecraft}/${loader}/profile/json`
          : `/v2/versions/loader/${minecraft}/${loader}/server/json`
      const profileUrls = [
        ...(shouldOverrideApiSet(this.settings, this.gfw.inside)
          ? getApiSets(this.settings).map((set) => `${set.url}/fabric-meta${profilePath}`)
          : []),
        `${DEFAULT_META_URL_FABRIC}${profilePath}`,
      ]
      const workflow = createFabricInstallWorkflow({
        minecraft: this.getPath(),
        minecraftVersion: minecraft,
        version: loader,
        inheritsFrom: base,
        side,
        profileUrls,
      })
      const version = await this.runWorkflow(workflow, options)
      task.complete()
      return version
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async applyQuiltRecipe(
    minecraft: string,
    loader: string,
    base?: string,
    side: 'client' | 'server' = 'client',
  ) {
    const task = this.tasks.create<InstallQuiltTask>({
      type: 'installQuilt',
      key: `${minecraft}-quilt${loader}`,
      version: loader,
      minecraft,
    })
    const options = this.getInstallOptions(
      {
        side,
        inheritsFrom: base,
      },
      task,
    )
    try {
      const profilePath =
        side === 'client'
          ? `/v3/versions/loader/${minecraft}/${loader}/profile/json`
          : `/v3/versions/loader/${minecraft}/${loader}/server/json`
      const profileUrls = [
        ...(shouldOverrideApiSet(this.settings, this.gfw.inside)
          ? getApiSets(this.settings).map((set) => `${set.url}/quilt-meta${profilePath}`)
          : []),
        `${DEFAULT_META_URL_QUILT}${profilePath}`,
      ]
      const workflow = createQuiltInstallWorkflow({
        minecraft: this.getPath(),
        minecraftVersion: minecraft,
        version: loader,
        inheritsFrom: base,
        side,
        profileUrls,
      })
      const version = await this.runWorkflow(workflow, options)
      task.complete()
      return version
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async applyLabyModRecipe(manifest: InstallLabyModOptions['manifest'], minecraft: string) {
    const task = this.tasks.create<InstallLabyModTask>({
      type: 'installLabyMod',
      key: `${minecraft}-labymod${manifest.labyModVersion}`,
      version: manifest.labyModVersion,
      minecraft,
    })
    const options = this.getInstallOptions({ side: 'client' }, task)
    try {
      const workflow = createLabyModInstallWorkflow(
        manifest,
        minecraft,
        MinecraftFolder.from(this.getPath()),
        'production',
      )
      const tracker = onDownloadMultiple(
        options.tracker as Tracker<LibrariesTrackerEvents> | undefined,
        'libraries',
        { count: Object.keys(manifest.assets).length },
      )
      const version = await this.runWorkflow(workflow, options, tracker)
      task.complete()
      return version
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async resolveForgeProcessor(processor: PostProcessor): Promise<ForgeProcessorResolution> {
    const parsed = {} as Record<string, string>
    for (let index = 0; index < processor.args.length; index++) {
      const argument = processor.args[index]
      const value = processor.args[index + 1]
      if (argument.startsWith('--') && value && !value.startsWith('--')) parsed[argument] = value
    }
    if (parsed['--task'] !== 'DOWNLOAD_MOJMAPS' || processor.args.includes('--sanitize')) {
      return { handled: false }
    }
    const versionId = parsed['--version']
    const side = parsed['--side']
    const output = parsed['--output']
    if (!versionId || !side || !output) return { handled: false }
    const version = await readFile(this.getPath('versions', versionId, `${versionId}.json`), 'utf8')
      .then((content) => JSON.parse(content) as Version)
      .catch(() => undefined)
    const mapping = version?.downloads?.[`${side}_mappings`]
    if (!mapping) return { handled: false }
    const sets = shouldOverrideApiSet(this.settings, this.gfw.inside)
      ? [...getApiSets(this.settings), { name: 'mojang', url: '' }]
      : [{ name: 'mojang', url: '' }]
    const urls = sets.map((set) =>
      set.name === 'mojang' ? mapping.url : replaceHost(mapping.url, set.url),
    )
    const file: InstallFile = {
      path: output.replace('.tsrg', '.original.tsrg'),
      urls: [...new Set(urls)],
      size: mapping.size,
      checksum: mapping.sha1 ? { algorithm: 'sha1', value: mapping.sha1 } : undefined,
    }
    return { handled: true, files: [file] }
  }

  private async applyModernForgeWorkflow(options: {
    type: 'forge' | 'neoforge'
    minecraft: string
    version: string
    installer?: { path: string; sha1?: string }
    java: string
    base?: string
    side?: 'client' | 'server'
    libraryTracker?: ProgressTrackerMultiple
  }) {
    const folder = MinecraftFolder.from(this.getPath())
    const task =
      options.type === 'forge'
        ? this.tasks.create<InstallForgeTask>({
            type: 'installForge',
            key: `${options.minecraft}-forge${options.version}`,
            version: options.version,
            mcversion: options.minecraft,
          })
        : this.tasks.create<InstallNeoForgeTask>({
            type: 'installNeoForge',
            key: `${options.minecraft}-neoforged${options.version}`,
            version: options.version,
            minecraft: options.minecraft,
          })
    const installOptions = this.getInstallOptions(
      {
        side: options.side ?? 'client',
        java: options.java,
        inheritsFrom: options.base ?? options.minecraft,
      },
      task,
    )
    let artifactVersion: string
    let installer: InstallFile
    const legacyUniversal = options.type === 'forge' && options.minecraft.startsWith('1.4.')
    if (options.type === 'forge') {
      artifactVersion = resolveForgeArtifactVersion(options.minecraft, options.version)
      installer = resolveForgeInstallerFile(
        artifactVersion,
        options.installer,
        folder,
        installOptions,
        legacyUniversal,
      ).file
    } else {
      const legacy = options.version.startsWith('47.') || options.version.startsWith('1.20.1-47.')
      const project = legacy ? 'forge' : 'neoforge'
      const publishedVersion =
        legacy && options.version.startsWith('47.')
          ? `${options.minecraft}-${options.version}`
          : options.version
      artifactVersion = publishedVersion
      installer = (
        await resolveNeoForgedInstallerFile(project, publishedVersion, folder, installOptions)
      ).file
    }
    const javaArgs: string[] = []
    if (this.settings.httpProxy && this.settings.httpProxyEnabled) {
      const proxy = new URL(this.settings.httpProxy)
      if (proxy.hostname && proxy.port) {
        javaArgs.push(
          `-Dhttp.proxyHost=${proxy.hostname}`,
          `-Dhttp.proxyPort=${proxy.port}`,
          `-Dhttps.proxyHost=${proxy.hostname}`,
          `-Dhttps.proxyPort=${proxy.port}`,
        )
      } else {
        javaArgs.push('-Djava.net.useSystemProxies=true')
      }
    }
    const runWorkflow = legacyUniversal
      ? () =>
          this.runWorkflow(
            createLegacyForgeInstallWorkflow({
              id: `${options.type}:${options.version}`,
              minecraft: folder,
              minecraftVersion: options.minecraft,
              universal: installer,
              artifactVersion,
              installOptions,
            }),
            installOptions,
            onDownloadMultiple(
              installOptions.tracker as Tracker<ForgeTrackerEvents>,
              'forge.installer',
              { version: options.version, path: installer.path },
            ),
          )
      : async () =>
          {
            const installerTracker = onDownloadMultiple(
              installOptions.tracker as Tracker<ForgeTrackerEvents>,
              'forge.installer',
              { version: options.version, path: installer.path },
            )
            return (
            await this.runWorkflow(
              createModernForgeInstallWorkflow({
                id: `${options.type}:${options.version}`,
                minecraft: folder,
                minecraftVersion: options.minecraft,
                installer,
                artifactVersion,
                java: options.java,
                installOptions,
                side: options.side,
                postprocessMetadata: {
                  loader: options.type,
                  minecraftVersion: options.minecraft,
                  side: options.side ?? 'client',
                },
                batchLauncher: {
                  path: join(this.app.appDataPath, 'MultiJarLauncher.class'),
                  content: Buffer.from(clazData).toString('base64'),
                  encoding: 'base64',
                  javaArgs,
                  classpath: this.app.appDataPath,
                  cwd: this.app.appDataPath,
                },
                resolveProcessor: (processor) => this.resolveForgeProcessor(processor),
              }),
              installOptions,
              (_plan, stage) => stage === 0
                ? installerTracker
                : stage === 2 || stage === 4
                  ? options.libraryTracker ?? installerTracker
                  : undefined,
            )
            ).version
          }
    try {
      const result = await this.app.mutex
        .of(LockKey.libraries)
        .runExclusive(() => this.runForgeInstall(options.minecraft, runWorkflow))
      task.complete()
      return result
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private async applyProfileWorkflow(
    profile: InstallProfileOptions['profile'],
    java: string,
    side: 'client' | 'server' = 'client',
  ) {
    const folder = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallProfileTask>({
      type: 'installProfile',
      key: profile.version,
      version: profile.version,
    })
    const options = this.getInstallOptions(
      {
        side,
        java,
        inheritsFrom: profile.minecraft,
      },
      task,
    )
    const javaArgs: string[] = []
    if (this.settings.httpProxy && this.settings.httpProxyEnabled) {
      const proxy = new URL(this.settings.httpProxy)
      if (proxy.hostname && proxy.port) {
        javaArgs.push(
          `-Dhttp.proxyHost=${proxy.hostname}`,
          `-Dhttp.proxyPort=${proxy.port}`,
          `-Dhttps.proxyHost=${proxy.hostname}`,
          `-Dhttps.proxyPort=${proxy.port}`,
        )
      }
    }
    const workflow = createProfileInstallWorkflow({
      id: `profile:${profile.version}`,
      profile,
      minecraft: folder,
      java,
      installOptions: options,
      side,
      postprocessMetadata: {
        loader: 'profile',
        minecraftVersion: profile.minecraft,
        side,
      },
      batchLauncher: {
        path: join(this.app.appDataPath, 'MultiJarLauncher.class'),
        content: Buffer.from(clazData).toString('base64'),
        encoding: 'base64',
        javaArgs,
        classpath: this.app.appDataPath,
        cwd: this.app.appDataPath,
      },
      resolveProcessor: (processor) => this.resolveForgeProcessor(processor),
    })
    try {
      const tracker = onDownloadMultiple(
        options.tracker as Tracker<LibrariesTrackerEvents>,
        'libraries',
        { count: profile.libraries?.length ?? 0 },
      )
      const result = await this.app.mutex
        .of(LockKey.libraries)
        .runExclusive(() =>
          this.runForgeInstall(profile.minecraft, () => this.runWorkflow(workflow, options, tracker)),
        )
      task.complete()
      return result
    } catch (error) {
      task.fail(error)
      throw error
    }
  }

  private applyInstanceVersionRecipe(recipe: VersionInstallManifest) {
    const context = {
      timings: [] as Array<{
        task: string
        type: InstallTask['type']
        startedAt: number
        duration: number
      }>,
    }
    const task: TaskInstance<Task> =
      recipe.kind === 'install'
        ? this.tasks.create<InstallMinecraftTask>({
            type: 'installVersion',
            key: recipe.minecraft.id,
            version: recipe.minecraft.id,
          })
        : this.tasks.create<InstallLibrariesTask>({
            type: 'installLibraries',
            key: `repair:${recipe.version}`,
          })
    return task.wrap(
      this.installContext.run(context, () =>
        this.applyInstanceVersionRecipeImpl(recipe, context, task),
      ),
    )
  }

  private async applyInstanceVersionRecipeImpl(
    recipe: VersionInstallManifest,
    context: {
      timings: Array<{
        task: string
        type: InstallTask['type']
        startedAt: number
        duration: number
      }>
    },
    task: TaskInstance<Task>,
  ) {
    if (recipe.schemaVersion !== 2) {
      throw new Error(`Unsupported instance version recipe schema: ${recipe.schemaVersion}`)
    }
    const startedAt = Date.now()
    const resolveJava = async (version: string) => {
      if (recipe.java.preferred) {
        const preferred = await this.javaService.resolveJava(recipe.java.preferred)
        if (preferred) return preferred.path
      }
      if (recipe.java.fallback) {
        return this.ensureJava(recipe.java.fallback).then((java) => java.path)
      }
      const resolved = await this.versionService.resolveLocalVersion(version)
      const matched = this.javaService.state.all.find(
        (java) => java.valid && java.majorVersion === resolved.javaVersion.majorVersion,
      )
      return matched?.path ?? this.ensureJava(resolved.javaVersion).then((java) => java.path)
    }
    const settle = async <T>(primary: Promise<T>, work: Promise<unknown>[]) => {
      const results = await Promise.allSettled([primary, ...work])
      const first = results[0]
      if (first.status === 'rejected') throw first.reason
      const failure = results.slice(1).find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
      return first.value
    }

    let version: string
    if (recipe.kind === 'install') {
      const minecraft = recipe.minecraft.id
      const folder = MinecraftFolder.from(this.getPath())
      const baseTimestamp = await this.getVersionInstallTimestamp(minecraft)
      const librariesTask = this.tasks.create<InstallLibrariesTask>({
        type: 'installLibraries',
        key: `${minecraft}:libraries`,
      })
      const assetsTask = this.tasks.create<InstallAssetsTask>({
        type: 'installAssets',
        key: `${minecraft}:assets`,
        version: minecraft,
      })
      const options = this.getInstallOptions({ side: 'client' }, task)
      const baseOptions = { ...options, timestamp: baseTimestamp }
      const libraryOptions = this.getInstallOptions({ side: 'client', timestamp: baseTimestamp }, librariesTask)
      const assetOptions = this.getInstallOptions({ side: 'client', timestamp: baseTimestamp }, assetsTask)
      let resolved = await this.versionService.resolveLocalVersion(minecraft).catch(() => undefined)
      if (!resolved) {
        const json = resolveMinecraftVersionJsonInstallFile(recipe.minecraft, folder, options)
        await this.executePrimitivePlan(
          {
            schemaVersion: 1,
            tasks: [{ id: 'minecraft-version-json', type: 'files', files: [json] }],
          },
          options,
          onDownloadMultiple(options.tracker as Tracker<MinecraftTrackerEvents>, 'version.json', {
            id: minecraft,
            url: recipe.minecraft.url,
          }),
        )
        resolved = await this.versionService.resolveLocalVersion(minecraft)
      }
      const java = resolveJava(minecraft)
      const jarFile = resolveMinecraftJarInstallFile(resolved, baseOptions)
      const jar = jarFile
        ? this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [{ id: 'minecraft-client-jar', type: 'files', files: [jarFile] }],
            },
            options,
            onDownloadMultiple(options.tracker as Tracker<MinecraftTrackerEvents>, 'version.jar', {
              id: minecraft,
              side: 'client',
              size: jarFile.size ?? 0,
              sha1: jarFile.checksum?.value,
            }),
          )
        : Promise.resolve()
      const libraries = librariesTask.wrap(
        this.executePrimitivePlan(
          {
            schemaVersion: 1,
            tasks: [
              {
                id: 'minecraft-libraries',
                type: 'files',
                files: resolveLibraryInstallFiles(resolved.libraries, folder, libraryOptions),
              },
            ],
          },
          libraryOptions,
          onDownloadMultiple(
            libraryOptions.tracker as Tracker<LibrariesTrackerEvents>,
            'libraries',
            { count: resolved.libraries.length },
          ),
        ),
      )
      const assets = assetsTask.wrap(
        (async () => {
          await this.executePrimitivePlan(
            resolveAssetMetadataInstallManifest(resolved!, folder, assetOptions),
            assetOptions,
            onDownloadMultiple(
              assetOptions.tracker as Tracker<AssetsTrackerEvents>,
              'assets.assetIndex',
              { url: resolved!.assetIndex?.url ?? '' },
            ),
          )
          const files = await resolveAssetObjectInstallFiles(resolved!, folder, assetOptions)
          await this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [{ id: 'minecraft-assets', type: 'files', files }],
            },
            assetOptions,
            onDownloadMultiple(
              assetOptions.tracker as Tracker<AssetsTrackerEvents>,
              'assets.assets',
              { count: files.length },
            ),
          )
        })(),
      )

      let output = Promise.resolve(minecraft)
      for (const layer of recipe.layers) {
        output = output.then(async (base) => {
          if (layer.type === 'use') {
            await this.versionService.refreshVersion(layer.version)
            return layer.version
          }
          if (layer.type === 'labymod') {
            return this.applyLabyModRecipe(layer.manifest, minecraft)
          }
          if (layer.type === 'forge') {
            const javaPath = await java
            await Promise.all([jar, libraries])
            return this.applyModernForgeWorkflow({
              type: 'forge',
              minecraft,
              version: layer.version,
              installer: layer.installer,
              java: javaPath,
              base: base === minecraft ? undefined : base,
            })
          }
          if (layer.type === 'neoforge') {
            const javaPath = await java
            await Promise.all([jar, libraries])
            return this.applyModernForgeWorkflow({
              type: 'neoforge',
              minecraft,
              version: layer.version,
              java: javaPath,
              base: base === minecraft ? undefined : base,
            })
          }
          if (layer.type === 'fabric') {
            return this.applyFabricRecipe(
              minecraft,
              layer.loader,
              base === minecraft ? undefined : base,
            )
          }
          if (layer.type === 'quilt') {
            return this.applyQuiltRecipe(
              minecraft,
              layer.loader,
              base === minecraft ? undefined : base,
            )
          }
          const javaPath = await java
          await Promise.all([jar, libraries])
          const { type, patch } = parseOptifineVersion(layer.version)
          return this.applyOptifinePlan({
            mcversion: minecraft,
            type,
            patch,
            java: javaPath,
            inheritFrom: base === minecraft ? undefined : base,
          })
        })
      }
      const finalContent = output.then(async (target) => {
        if (target !== minecraft) {
          const targetVersion = await this.versionService.resolveLocalVersion(target)
          await this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [
                {
                  id: 'final-version-libraries',
                  type: 'files',
                  files: resolveLibraryInstallFiles(targetVersion.libraries, folder, options),
                },
              ],
            },
            options,
          )
        }
      })
      version = await settle(output, [jar, libraries, assets, java, finalContent])
    } else {
      const issue = recipe.issue
      const folder = MinecraftFolder.from(this.getPath())
      const options = this.getInstallOptions({ side: 'client' }, task)
      const repairTracker = onDownloadMultiple(
        options.tracker as Tracker<LibrariesTrackerEvents>,
        'libraries',
        { count: (issue.libraries?.length ?? 0) + (issue.assets?.length ?? 0) + (issue.jar ? 1 : 0) },
      )
      const resolved = await this.versionService.resolveLocalVersion(recipe.version)
      const java = resolveJava(issue.forge?.minecraft ?? recipe.runtime.minecraft ?? recipe.version)
      const jarFile = issue.jar ? resolveMinecraftJarInstallFile(resolved, options) : undefined
      const jar = jarFile
        ? this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [{ id: 'repair-jar', type: 'files', files: [jarFile] }],
            },
            options,
            repairTracker,
          )
        : Promise.resolve()
      const independent: Promise<unknown>[] = []
      const repairLoaderProfile = !!issue.profile && !!(recipe.runtime.forge || recipe.runtime.neoForged)
      const libraries = issue.libraries?.filter((library) => {
        if (issue.optifine && library.groupId === 'optifine') return false
        if (
          issue.forge &&
          library.groupId === 'net.minecraftforge' &&
          library.artifactId === 'forge'
        )
          return false
        return true
      })
      const libraryRepair = libraries?.length
        ? this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [
                {
                  id: 'repair-libraries',
                  type: 'files',
                  files: resolveLibraryInstallFiles(libraries, folder, options),
                },
              ],
            },
            options,
            repairTracker,
          )
        : Promise.resolve()
      if (issue.assetsIndex) {
        independent.push(
          (async () => {
            await this.executePrimitivePlan(
              resolveAssetMetadataInstallManifest(resolved, folder, options),
              options,
              repairTracker,
            )
            await this.executePrimitivePlan(
              {
                schemaVersion: 1,
                tasks: [
                  {
                    id: 'repair-assets',
                    type: 'files',
                    files: await resolveAssetObjectInstallFiles(resolved, folder, options),
                  },
                ],
              },
              options,
              repairTracker,
            )
          })(),
        )
      } else if (issue.assets?.length) {
        independent.push(
          this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [
                {
                  id: 'repair-assets',
                  type: 'files',
                  files: resolveAssetInstallFiles(issue.assets, folder, options),
                },
              ],
            },
            options,
            repairTracker,
          ),
        )
      }

      let output = Promise.resolve(recipe.version)
      if (issue.profile) {
        output = Promise.all([java, jar, libraryRepair]).then(async ([javaPath]) => {
          if (recipe.runtime.neoForged) {
            return this.applyModernForgeWorkflow({
              type: 'neoforge',
              minecraft: recipe.runtime.minecraft,
              version: recipe.runtime.neoForged,
              java: javaPath,
              libraryTracker: repairTracker,
            })
          }
          if (recipe.runtime.forge) {
            return this.applyModernForgeWorkflow({
              type: 'forge',
              minecraft: recipe.runtime.minecraft,
              version: recipe.runtime.forge,
              java: javaPath,
              libraryTracker: repairTracker,
            })
          }
          await this.applyProfileWorkflow(issue.profile!, javaPath)
          return recipe.version
        })
      } else if (issue.optifine) {
        output = Promise.all([java, jar, libraryRepair]).then(async ([javaPath]) => {
          const { type, patch } = parseOptifineVersion(issue.optifine!)
          return this.applyOptifinePlan({
            mcversion: recipe.runtime.minecraft,
            type,
            patch,
            java: javaPath,
          })
        })
      } else if (issue.forge) {
        output = Promise.all([java, jar, libraryRepair]).then(async ([javaPath]) =>
          this.applyModernForgeWorkflow({
            type: 'forge',
            minecraft: issue.forge!.minecraft,
            version: issue.forge!.version,
            java: javaPath,
            libraryTracker: repairTracker,
          }),
        )
      }
      const finalContent = output.then(async (target) => {
        if (!repairLoaderProfile && (target !== recipe.version || issue.profile)) {
          const targetVersion = await this.versionService.resolveLocalVersion(target)
          await this.executePrimitivePlan(
            {
              schemaVersion: 1,
              tasks: [
                {
                  id: 'repair-final-libraries',
                  type: 'files',
                  files: resolveLibraryInstallFiles(targetVersion.libraries, folder, options),
                },
              ],
            },
            options,
            repairTracker,
          )
        }
      })
      version = await settle(output, [java, jar, libraryRepair, ...independent, finalContent])
    }

    const timestamp = Date.now()
    const result = {
      version,
      timestamp,
      duration: timestamp - startedAt,
      timings: context.timings.sort((a, b) => a.startedAt - b.startedAt),
    }
    await this.markVersionInstallation(result)
    this.logger.log(`[install-recipe] installed ${version} in ${result.duration}ms`)
    return result
  }

  async diagnose(options: DiagnoseOptions) {
    const key = `${options.side}:${options.version}`
    return this.diagnosisCache.getOrCreate(key, () => this.diagnoseUncached(options))
  }

  private async diagnoseUncached(options: DiagnoseOptions) {
    const timestamp = await this.getVersionInstallTimestamp(options.version)
    if (options.side === 'server') {
      const resolved = await this.versionService.resolveServerVersion(options.version)
      const base = await this.versionService.resolveLocalVersion(resolved.minecraftVersion)
      return diagnoseServerInstallation(resolved, MinecraftFolder.from(this.getPath()), base, {
        timestamp,
        checksum: (file, algorithm) => this.checksumForDiagnosis(file, algorithm),
      })
    }
    const resolved = await this.versionService.resolveLocalVersion(options.version)
    return this.diagnoseClientVersion(resolved, { timestamp })
  }

  private async diagnoseClientVersion(
    currentVersion: ResolvedVersion,
    options: { timestamp?: number; strict?: boolean } = {},
  ) {
    try {
      this.logger.log(`Diagnose installation for ${currentVersion.id} (client)`)
      const timestamp = options.strict
        ? undefined
        : (options.timestamp ?? (await this.getVersionInstallTimestamp(currentVersion.id)))
      const result = await diagnoseInstallation(currentVersion, {
        timestamp,
        strict: options.strict,
        checksum: (file, algorithm) => this.checksumForDiagnosis(file, algorithm),
      })
      this.logger.log(`Successfully diagnosed installation for ${currentVersion.id} (client)`)
      return result || undefined
    } catch (e) {
      this.logger.warn(
        `An error occurred during diagnosing installation for ${currentVersion.id} (client):`,
      )
      this.logger.warn(e)
      throw e
    }
  }

  private async getVersionInstallTimestamp(version: string) {
    const folder = MinecraftFolder.from(this.getPath())
    const lockPath = join(folder.getVersionRoot(version), '.install-lock')
    return readFile(lockPath, 'utf8')
      .then(
        (content) =>
          JSON.parse(content) as { schemaVersion?: number; version?: string; timestamp?: number },
      )
      .then((lock) =>
        lock.schemaVersion === 1 && lock.version === version && typeof lock.timestamp === 'number'
          ? lock.timestamp
          : undefined,
      )
      .catch(() => undefined)
  }

  private checksumForDiagnosis(file: string, algorithm: string) {
    const key = `${algorithm}\0${file}`
    return this.diagnosisChecksums.getOrCreate(key, () => this.resourceWorker.checksum(file, algorithm))
  }

  private invalidateDiagnosis() {
    this.diagnosisCache.invalidate()
    this.diagnosisChecksums.clear()
  }
}
