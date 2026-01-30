import { checksum, LibraryInfo, MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core'
import { download, type DownloadBaseOptions } from '@xmcl/file-transfer'
import {
  AnyTracker,
  AssetsOptions,
  completeInstallation,
  DEFAULT_FORGE_MAVEN,
  DEFAULT_RESOURCE_ROOT_URL,
  installAssets,
  installByProfile,
  InstallError,
  installFabric,
  installForge,
  installLabyMod4,
  installLibraries,
  installMinecraft,
  installMinecraftJar,
  installNeoForge,
  installOptifine,
  installQuiltVersion,
  installResolvedAssets,
  installResolvedLibraries,
  JarOption,
  LibrariesTrackerEvents,
  LibraryOptions,
  onDownloadSingle,
  PostProcessFailedError,
  Tracker,
  type InstallForgeOptions,
  type PostProcessor,
} from '@xmcl/installer'
import { waitProcess } from '@xmcl/installer/utils'
import {
  Task,
  DiagnoseOptions,
  findNeoForgedVersion,
  InstallAssetsForVersionOptions,
  InstallAssetsOptions,
  InstallAssetsTask,
  InstallDependenciesOptions,
  InstallFabricTask,
  InstallForgeTask,
  InstallLabyModTask,
  InstallLibrariesOptions,
  InstallLibrariesTask,
  InstallMinecraftJarOptions,
  InstallMinecraftOptions,
  InstallMinecraftTask,
  InstallNeoForgeTask,
  InstallOptifineTask,
  InstallProfileTask,
  InstallQuiltTask,
  InstallServiceKey,
  isFabricLoaderLibrary,
  isForgeLibrary,
  isQuiltLibrary,
  LockKey,
  ReinstallOptions,
  ReinstallTask,
  Settings,
  type InstallForgeOptions as _InstallForgeOptions,
  type InstallService as IInstallService,
  type InstallFabricOptions,
  type InstallLabyModOptions,
  type InstallNeoForgedOptions,
  type InstallOptifineAsModOptions,
  type InstallOptifineOptions,
  type InstallProfileOptions,
  type InstallQuiltOptions,
  type OptifineVersion,
  type SharedState,
} from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { ensureDir, ensureFile, readFile, stat, unlink, writeFile } from 'fs-extra'
import { delimiter, dirname, join } from 'path'
import { Inject, kGameDataPath, LauncherApp, LauncherAppKey, type PathResolver } from '~/app'
import { GFW, kGFW, kTasks, TaskInstance, Tasks } from '~/infra'
import { JavaService } from '~/java'
import { kDownloadOptions } from '~/network'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { linkOrCopyFile } from '~/util/fs'
import { joinUrl, replaceHost } from '~/util/url'
import { VersionService } from '~/launch'
import { kOptifineInstaller } from './optifine'
import { formatMinecraftSrg } from './utils/formatMinecraftSrg'
// @ts-ignore
import clazData from './utils/MultiJarLauncher.class'
import { getTracker } from '~/util/taskHelper'
import { kResourceWorker, ResourceWorker } from '~/resource'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
@ExposeServiceKey(InstallServiceKey)
export class InstallService extends AbstractService implements IInstallService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kGFW) private gfw: GFW,
    @Inject(kSettings) private settings: SharedState<Settings>,
    @Inject(kDownloadOptions) private downloadOptions: DownloadBaseOptions,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kResourceWorker) private resourceWorker: ResourceWorker,
  ) {
    super(app)
  }

  protected createFetchWithFallback(
    apiSets: string[],
    preferDefault: boolean,
    metaPath: string,
  ): (url: string, init?: RequestInit) => Promise<Response> {
    return (i, init) => {
      const url = new URL(i)
      const apis = apiSets.map((a) => a + metaPath)
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
      fetch?: (url: string, init?: RequestInit) => Promise<Response>
    },
    task: TaskInstance<Task>,
  ) {
    const tracker: AnyTracker | undefined = getTracker(task)
    const options: LibraryOptions & AssetsOptions & InstallForgeOptions & JarOption = {
      ...this.downloadOptions,
      useHashForAssetsIndex: true,
      tracker,
      fetch: overrides.fetch ?? (this.app.fetch as any),
      ...overrides,
      signal: task.controller.signal,
      checksum: (file, algorithm) => this.resourceWorker.checksum(file, algorithm),
    }

    const allSets = getApiSets(this.settings)

    if (shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      const existed = allSets.find((a) => a.name === this.settings.apiSetsPreference)
      if (existed) {
        // make bmclapi echo 3 time
        allSets.push(existed, existed, existed)
      }
      allSets.push({ name: 'mojang', url: '' })
    } else {
      allSets.unshift({ name: 'mojang', url: '' })
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
    options.handler = async (postProcessor: PostProcessor) => {
      const parsedArgs = {} as Record<string, string>
      for (let i = 0; i < postProcessor.args.length; i++) {
        const arg = postProcessor.args[i]
        if (arg.startsWith('--')) {
          const next = postProcessor.args[i + 1]
          if (next && !next.startsWith('--')) {
            parsedArgs[arg] = postProcessor.args[i + 1]
          }
        }
      }
      const task = parsedArgs['--task']

      if (
        task !== 'DOWNLOAD_MOJMAPS' ||
        this.settings.apiSetsPreference === 'mojang' ||
        this.settings.httpProxyEnabled
      ) {
        return false
      }
      if (!parsedArgs['--version'] || !parsedArgs['--side'] || !parsedArgs['--output']) return false

      const sanitize = postProcessor.args.includes('--sanitize')

      const versionContent = await readFile(
        this.getPath('versions', parsedArgs['--version'], `${parsedArgs['--version']}.json`),
        'utf-8',
      ).catch(() => '')
      if (!versionContent) return false

      const version: Version = JSON.parse(versionContent)
      const mapping = version.downloads?.[`${parsedArgs['--side']}_mappings`]
      if (!mapping) return false
      const output = parsedArgs['--output']
      const originalOutput = output.replace('.tsrg', '.original.tsrg')
      const sha1 = await checksum(originalOutput, 'sha1').catch(() => undefined)
      if (sha1 === mapping.sha1) {
        if (sanitize) {
          const mc = MinecraftFolder.from(this.getPath())
          const cps = postProcessor.classpath
            .map(LibraryInfo.resolve)
            .map((p) => mc.getLibraryByPath(p.path))
          await formatMinecraftSrg(
            originalOutput,
            output,
            options.java || 'java',
            this.app.appDataPath,
            cps,
          ).catch((e) => {
            this.error(e)
          })
        }
        return true
      }
      const url = new URL(mapping.url)
      const urls = allSets.map((api) => {
        if (api.name === 'mojang') {
          return url.toString()
        }
        return replaceHost(url, api.url)
      })
      for (const u of urls) {
        try {
          const response = await this.app.fetch(u)
          if (response.ok) {
            const text = await response.text()
            await ensureDir(dirname(originalOutput))
            await writeFile(originalOutput, text)
            if (sanitize) {
              const mc = MinecraftFolder.from(this.getPath())
              const cps = postProcessor.classpath
                .map(LibraryInfo.resolve)
                .map((p) => mc.getLibraryByPath(p.path))
              await formatMinecraftSrg(
                originalOutput,
                output,
                options.java || 'java',
                this.app.appDataPath,
                cps,
              ).catch(async (e) => {
                await writeFile(output, text)
                this.error(e)
              })
            }
            return true
          }
        } catch (e) {
          this.warn(`Failed to download mojmap from ${u}`)
          this.warn(e)
        }
      }
      return false
    }
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
    options.postprocess = async (procs, folder, opts, originalPostprocess) => {
      // Use unified multi jar launcher to do the postprocess at once
      const app = this.app
      const toBase64String = (s: string) => Buffer.from(s).toString('base64')

      const skip = [] as PostProcessor[]
      for (const proc of procs) {
        const handled = await opts.handler!(proc)
        if (handled) {
          skip.push(proc)
        }
      }
      const clz = join(app.appDataPath, 'MultiJarLauncher.class')
      await writeFile(clz, clazData)
      try {
        const pending = procs.filter((p) => !skip.includes(p))
        const classPaths = pending
          .map((p) => p.jar)
          .concat(pending.flatMap((p) => p.classpath))
          .map((p) => folder.getLibraryByPath(LibraryInfo.resolve(p).path))
          .concat(app.appDataPath)

        const args = pending.map((p) =>
          toBase64String(
            [folder.getLibraryByPath(LibraryInfo.resolve(p.jar).path), ...p.args].join('|'),
          ),
        )
        const process = spawn(
          options.java!,
          ['-cp', classPaths.join(delimiter), 'MultiJarLauncher', ...args],
          {
            cwd: app.appDataPath,
          },
        )
        await waitProcess(process)
      } catch (e) {
        Object.assign(e as any, {
          name: 'CustomPostProcessError',
        })
        if (e instanceof Error) {
          if (e.message.indexOf('Could not find or load main class')) {
            Object.assign(e, {
              clzPath: clz,
              clzPathExists: existsSync(clz),
            })
          }
        }
        this.error(e as any)
        // Retry with original postprocess
        await originalPostprocess()
      } finally {
        await unlink(clz).catch(() => undefined)
      }
    }

    return options
  }

  @Lock((v) => [LockKey.version(v.version), LockKey.assets])
  async installAssetsForVersion(options: InstallAssetsForVersionOptions) {
    const location = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallAssetsTask>({
      type: 'installAssets',
      key: options.version,
      version: options.version,
    })
    try {
      const ops = this.getInstallOptions({ side: 'client' }, task)
      // This special logic is handling if the asset index info is missing.
      const resolvedVersion = await Version.parse(location, options.version)
      if (!resolvedVersion.assetIndex) {
        const versionMeta =
          options.fallbackVersionMetadata?.find((v) => v.id === resolvedVersion.minecraftVersion) ||
          options.fallbackVersionMetadata?.find((v) => v.id === resolvedVersion.assets)
        if (versionMeta) {
          let localVersion = await this.versionService
            .resolveLocalVersion(versionMeta.id)
            .catch(() => undefined)
          if (!localVersion) {
            await installMinecraft(versionMeta, location, ops)
            localVersion = await this.versionService.resolveLocalVersion(versionMeta.id)
          }
          resolvedVersion.assetIndex = localVersion.assetIndex
        }
      }
      this.log(`Install assets for ${options.version}:`)
      await installAssets(resolvedVersion, ops)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error ocurred during assets for ${options.version}:`)
      this.warn(e)
    }
  }

  @Lock((v) => [LockKey.version(v.version), LockKey.assets, LockKey.libraries])
  async installDependencies(options: InstallDependenciesOptions) {
    const location = this.getPath()
    const side = options.side ?? 'client'
    const task = this.tasks.create<InstallLibrariesTask>({
      type: 'installLibraries',
      key: options.version,
    })
    const ops = this.getInstallOptions({ side }, task)
    try {
      this.log(`Install dependencies for ${options.version} (${side})`)
      if (side === 'client') {
        const resolvedVersion = await Version.parse(location, options.version)
        await installLibraries(resolvedVersion, ops)
        await installAssets(resolvedVersion, ops)
      } else {
        const resolvedVersion = await this.versionService.resolveServerVersion(options.version)

        if (resolvedVersion.libraries.length === 0) {
          const clientVersion = await this.versionService.resolveLocalVersion(options.version)
          resolvedVersion.libraries = clientVersion.libraries
        }
        await installResolvedLibraries(resolvedVersion.libraries, location, ops)
      }
      this.log(`Successfully installed dependencies for ${options.version} (${side})`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error occurred during installing dependencies for ${options.version} (${side}):`)
      this.warn(e)
      throw e
    }
  }

  @Lock((v) => [LockKey.version(v.minecraftVersion)])
  async installLabyModVersion(options: InstallLabyModOptions) {
    const location = this.getPath()
    const task = this.tasks.create<InstallLabyModTask>({
      type: 'installLabyMod',
      key: `${options.minecraftVersion}-labymod${options.manifest.labyModVersion}`,
      version: options.manifest.labyModVersion,
      minecraft: options.minecraftVersion,
    })
    const ops = this.getInstallOptions({ side: 'client' }, task)
    try {
      this.log(`Install LabyMod ${options.manifest.labyModVersion} on ${options.minecraftVersion}`)
      const version = await task.wrap(
        installLabyMod4(options.manifest, options.minecraftVersion, location, ops),
      )
      this.log(`Successfully installed LabyMod ${options.manifest.labyModVersion} on ${options.minecraftVersion}`)
      return version
    } catch (e) {
      task.fail(e)
      this.warn(`An error occurred during installing LabyMod ${options.manifest.labyModVersion} on ${options.minecraftVersion}:`)
      this.warn(e)
      throw e
    }
  }

  @Lock((v) => [LockKey.version(v.version)])
  async reinstall(options: ReinstallOptions) {
    const location = this.getPath()
    const resolvedVersion = await this.versionService.resolveLocalVersion(options.version)
    if (!resolvedVersion) {
      throw new AnyError('ReinstallError', `Cannot reinstall ${options.version} as it's not found!`)
    }
    const task = this.tasks.create<ReinstallTask>({
      type: 'reinstall',
      key: options.version,
      version: options.version,
    })
    const ops = this.getInstallOptions({ side: options.side }, task)
    try {
      this.log(`Reinstall ${options.version} (${options.side})`)
      await installMinecraft({ id: resolvedVersion.minecraftVersion, url: '' }, location, ops)
      const forgeLib = resolvedVersion.libraries.find(isForgeLibrary)
      if (forgeLib) {
        await installForge(
          { version: forgeLib.version, mcversion: resolvedVersion.minecraftVersion },
          MinecraftFolder.from(location),
          ops,
        )
      }
      const fabLib = resolvedVersion.libraries.find(isFabricLoaderLibrary)
      if (fabLib) {
        await this.installFabric({
          minecraft: resolvedVersion.minecraftVersion,
          loader: fabLib.version,
        })
      }
      const neoForge = findNeoForgedVersion(resolvedVersion.minecraftVersion, resolvedVersion)
      if (neoForge) {
        await this.installNeoForged({
          minecraft: resolvedVersion.minecraftVersion,
          version: neoForge,
        })
      }
      const quilt = resolvedVersion.libraries.find(isQuiltLibrary)
      if (quilt) {
        await this.installQuilt({
          minecraftVersion: resolvedVersion.minecraftVersion,
          version: quilt.version,
        })
      }
      await installLibraries(resolvedVersion, ops)
      await installAssets(resolvedVersion, ops)
      this.log(`Successfully reinstalled ${options.version} (${options.side})`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error occurred during reinstalling ${options.version} (${options.side}):`)
      this.warn(e)
      throw e
    }
  }

  @Lock(LockKey.assets)
  async installAssets(options: InstallAssetsOptions) {
    const location = this.getPath()
    const folder = new MinecraftFolder(location)
    const task = this.tasks.create<InstallAssetsTask>({
      type: 'installAssets',
      key: options.key ?? 'assets',
      version: options.key ?? 'assets',
    })
    const ops = this.getInstallOptions({ side: 'client' }, task)
    try {
      this.log(`Install assets for ${options.key ?? 'assets'}`)
      if (options.force) {
        // Remove assets before download
        const promises = [] as Promise<void>[]
        for (const a of options.assets) {
          const path = folder.getAsset(a.hash)
          if (path) {
            promises.push(unlink(path).catch(() => {}))
          }
        }
        await Promise.all(promises)
      }

      await installResolvedAssets(options.assets, folder, options.key ?? 'assets', ops)
      this.log(`Successfully installed assets for ${options.key ?? 'assets'}`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error occurred during installing assets for ${options.key ?? 'assets'}:`)
      this.warn(e)
      throw e
    }
  }

  @Lock((v: InstallMinecraftOptions) => LockKey.version(v.meta.id))
  async installMinecraft(options: InstallMinecraftOptions) {
    const id = options.meta.id
    const task = this.tasks.create<InstallMinecraftTask>({
      type: 'installVersion',
      key: id,
      version: id,
    })
    const ops = this.getInstallOptions({ side: options.side }, task)
    try {
      this.log(`Install Minecraft ${id} (${options.side})`)
      await installMinecraft(options.meta, this.getPath(), ops)
      this.log(`Successfully installed Minecraft ${id} (${options.side})`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error ocurred during download version ${id}`)
      throw e
    }
  }

  @Lock((v: string) => LockKey.version(v))
  async installMinecraftJar(options: InstallMinecraftJarOptions) {
    const parsed = await this.versionService.resolveLocalVersion(options.version)
    const task = this.tasks.create<InstallMinecraftTask>({
      type: 'installVersion',
      key: options.version,
      version: options.version,
    })
    const ops = this.getInstallOptions({ side: options.side }, task)
    try {
      this.log(`Install Minecraft JAR for ${options.version} (${options.side})`)
      await installMinecraftJar(parsed, ops)
      this.log(`Successfully installed Minecraft JAR for ${options.version} (${options.side})`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn(`An error ocurred during download server version ${options.version}`)
      throw e
    }
  }

  @Lock(LockKey.libraries)
  async installLibraries(options: InstallLibrariesOptions) {
    let resolved: ResolvedLibrary[]
    if ('downloads' in options.libraries[0]) {
      resolved = Version.resolveLibraries(options.libraries)
    } else {
      resolved = options.libraries as any
    }
    const folder = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallLibrariesTask>({
      type: 'installLibraries',
      key: options.version ?? 'libraries',
    })
    const ops = this.getInstallOptions({}, task)
    try {
      this.log(`Install libraries for ${options.version ?? 'libraries'}`)
      if (options.force) {
        // remove lib before download
        const promises = [] as Promise<void>[]
        for (const lib of resolved) {
          const path = folder.getLibraryByPath(lib.path)
          if (path) {
            promises.push(unlink(path).catch(() => {}))
          }
        }
        await Promise.all(promises)
      }
      await installResolvedLibraries(resolved, folder, ops)
      this.log(`Successfully installed libraries for ${options.version ?? 'libraries'}`)
      task.complete()
    } catch (e) {
      task.fail(e)
      this.warn('An error ocurred during install libraries:')
      throw e
    }
  }

  @Lock((v: InstallNeoForgedOptions) => LockKey.version(`neoforged-${v.minecraft}-${v.version}`))
  async installNeoForged(options: InstallNeoForgedOptions) {
    const validJavaPaths = this.javaService.state.all.filter((v) => v.valid)

    if (options.java) {
      const java = validJavaPaths.find((v) => v.path === options.java)
      if (java) {
        validJavaPaths.splice(validJavaPaths.indexOf(java), 1)
        validJavaPaths.unshift(java)
      }
    }

    let version: string | undefined
    const mc = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallNeoForgeTask>({
      type: 'installNeoForge',
      key: `${options.minecraft}-neoforged${options.version}`,
      version: options.version,
      minecraft: options.minecraft,
    })
    for (const java of validJavaPaths) {
      try {
        this.log(
          `Start to install neoforge ${options.version} on ${options.minecraft} by ${java.path}`,
        )
        let target: 'forge' | 'neoforge'
        let neoforgeVersion: string
        if (options.version.startsWith('47.')) {
          // Fix the neoforge version url
          neoforgeVersion = `${options.minecraft}-${options.version}`
          target = 'forge'
        } else {
          neoforgeVersion = options.version
          target = options.version.startsWith(options.minecraft) ? 'forge' : 'neoforge'
        }
        const taskOps = this.getInstallOptions(
          { side: options.side, java: java.path, inheritsFrom: options.base ?? options.minecraft },
          task,
        )
        version = await installNeoForge(target, neoforgeVersion, mc, taskOps)

        const json = join(mc.getVersionRoot(version), 'install_profile.json')
        await unlink(json).catch(() => {})

        this.log(`Success to install neoforge ${options.version} on ${options.minecraft}`)
        task.complete()
        break
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.indexOf('sun.security.validator.ValidatorException') !== -1) {
            continue
          }
        }
        this.warn(
          `An error ocurred during download version ${options.version}@${options.minecraft}`,
        )
        this.warn(err)
        task.fail(err)
        throw err
      }
    }
    if (!version) {
      const err = new AnyError(
        'ForgeInstallError',
        `Cannot install forge ${options.version} on ${options.minecraft}`,
      )
      task.fail(err)
      throw err
    }
    return version
  }

  @Lock((v: _InstallForgeOptions) => LockKey.version(`forge-${v.mcversion}-${v.version}`))
  async installForge(options: _InstallForgeOptions) {
    const validJavaPaths = this.javaService.state.all.filter((v) => v.valid)
    const side = options.side ?? 'client'

    if (!validJavaPaths.length) {
      throw new AnyError('ForgeInstallError', 'No valid java found!')
    }

    if (options.java) {
      const java = validJavaPaths.find((v) => v.path === options.java)
      if (java) {
        validJavaPaths.splice(validJavaPaths.indexOf(java), 1)
        validJavaPaths.unshift(java)
      }
    }

    let version: string | undefined
    const mc = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallForgeTask>({
      type: 'installForge',
      key: `${options.mcversion}-forge${options.version}`,
      version: options.version,
      mcversion: options.mcversion,
    })
    for (const java of validJavaPaths) {
      try {
        this.log(
          `Start to install ${side} forge ${options.version} on ${options.mcversion} by ${java.path}`,
        )
        const taskOps = this.getInstallOptions(
          { side, java: java.path, inheritsFrom: options.base || options.mcversion },
          task,
        )
        version = await installForge(options, mc, taskOps)

        const json = join(mc.getVersionRoot(version), 'install_profile.json')
        await unlink(json).catch(() => {})

        this.log(`Success to install ${side} forge ${options.version} on ${options.mcversion}`)
        task.complete()
        break
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.indexOf('sun.security.validator.ValidatorException') !== -1) {
            continue
          }
          if (err.message.indexOf('java.util.zip.ZipException: invalid entry size') !== -1) {
            // Some file are not downloaded completely
            if (err instanceof PostProcessFailedError) {
              if (err.jarPath.indexOf('jarsplitter') !== -1) {
                // remove slim, extra and srg if present to force it to rework
                const slim = err.commands[err.commands.indexOf('--slim') + 1]
                const extra = err.commands[err.commands.indexOf('--extra') + 1]
                const srg = err.commands[err.commands.indexOf('--srg') + 1]
                if (existsSync(slim)) {
                  await unlink(slim)
                }
                if (existsSync(extra)) {
                  await unlink(extra)
                }
                if (existsSync(srg)) {
                  await unlink(srg)
                }
              }
            }
          }
        }
        this.warn(
          `An error ocurred during download version ${options.version}@${options.mcversion}, ${side}`,
        )
        this.warn(err)
        task.fail(err)
        throw err
      }
    }
    if (!version) {
      const err = new AnyError(
        'ForgeInstallError',
        `Cannot install forge ${options.version} on ${options.mcversion}, ${side}`,
      )
      task.fail(err)
      throw err
    }
    return version
  }

  @Lock((v: InstallFabricOptions) => LockKey.version(`fabric-${v.minecraft}-${v.loader}`))
  async installFabric(options: InstallFabricOptions) {
    this.log(`Start to install fabric: yarn ${options.yarn}, loader ${options.loader}.`)
    const path = this.getPath()
    const apiSets = getApiSets(this.settings).map((a) => a.url)
    const preferDefault = shouldOverrideApiSet(this.settings, this.gfw.inside)
    const task = this.tasks.create<InstallFabricTask>({
      type: 'installFabric',
      key: `${options.minecraft}-fabric${options.loader}`,
      loader: options.loader,
      minecraft: options.minecraft,
    })
    const ops = this.getInstallOptions(
      {
        side: options.side,
        inheritsFrom: options.base,
        fetch: this.createFetchWithFallback(apiSets, preferDefault, '/fabric-meta'),
      },
      task,
    )
    try {
      const versionId = await installFabric({
        minecraft: path,
        minecraftVersion: options.minecraft,
        side: options.side,
        version: options.loader,
        ...ops,
      })
      this.log(
        `Success to install fabric: yarn ${options.yarn}, loader ${options.loader}. The new version is ${versionId}`,
      )
      task.complete()
      return versionId
    } catch (e) {
      this.warn(
        `An error ocurred during install fabric yarn-${options.yarn}, loader-${options.loader}`,
      )
      this.warn(e)
      task.fail(e)
      throw e
    }
  }

  @Lock((v) => LockKey.version(`quilt-${v.minecraftVersion}-${v.version}`))
  async installQuilt(options: InstallQuiltOptions) {
    const side = options.side ?? 'client'
    const mc = MinecraftFolder.from(this.getPath())
    const apiSets = getApiSets(this.settings).map((a) => a.url)
    const preferDefault = shouldOverrideApiSet(this.settings, this.gfw.inside)
    const task = this.tasks.create<InstallQuiltTask>({
      type: 'installQuilt',
      key: `${options.minecraftVersion}-quilt${options.version}`,
      version: options.version,
      minecraft: options.minecraftVersion,
    })
    const ops = this.getInstallOptions(
      {
        side,
        inheritsFrom: options.base,
        fetch: this.createFetchWithFallback(apiSets, preferDefault, '/quilt-meta'),
      },
      task,
    )
    try {
      this.log(`Install Quilt ${options.version} on ${options.minecraftVersion} (${side})`)
      const version = await task.wrap(
        installQuiltVersion({
          ...ops,
          minecraft: mc,
          minecraftVersion: options.minecraftVersion,
          version: options.version,
        }),
      )
      this.log(`Successfully installed Quilt ${options.version} on ${options.minecraftVersion} (${side})`)
      return version
    } catch (e) {
      task.fail(e)
      this.warn(`An error occurred during installing Quilt ${options.version} on ${options.minecraftVersion} (${side}):`)
      this.warn(e)
      throw e
    }
  }

  async getOptifineDownloadUrl(version: OptifineVersion) {
    const installer = await this.app.registry.getIfPresent(kOptifineInstaller)
    if (installer) {
      return installer(version)
    }
    return `https://bmclapi2.bangbang93.com/optifine/${version.mcversion}/${version.type}/${version.patch}`
  }

  async installOptifineAsMod(options: InstallOptifineAsModOptions) {
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(
      `/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`,
    )
    const url = await this.getOptifineDownloadUrl(options)
    try {
      this.log(`Install OptiFine ${optifineVersion} as mod for ${options.mcversion}`)
      const response = await this.app.fetch(url, { method: 'HEAD' })
      const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10)
      if (isNaN(contentLength)) {
        throw new Error()
      }
      const localLength = (await stat(path).catch(() => ({ size: 0 }))).size
      if (contentLength !== localLength) {
        throw new Error()
      }
    } catch {
      const task = this.tasks.create<InstallOptifineTask>({
        type: 'installOptifine',
        key: `${options.mcversion}-optifine-mod${options.type}_${options.patch}`,
        version: `${options.type}_${options.patch}`,
        minecraft: options.mcversion,
      })
      const tracker: Tracker<LibrariesTrackerEvents> = getTracker(task)
      await download({
        ...this.downloadOptions,
        url,
        destination: path,
        tracker: onDownloadSingle(tracker, 'libraries', {
          count: 1,
        }),
      })
    }
    await linkOrCopyFile(path, join(options.instancePath, 'mods', `OptiFine-${version}.jar`)).catch(
      (e) => {
        throw new AnyError(
          'OptifineInstallError',
          `Failed to copy OptiFine to mods folder. ${e.code}`,
        )
      },
    )
    this.log(`Successfully installed OptiFine ${optifineVersion} as mod for ${options.mcversion}`)
  }

  @Lock((v: InstallOptifineOptions) =>
    LockKey.version(`optifine-${v.mcversion}-${v.type}_${v.patch}`),
  )
  async installOptifine(options: InstallOptifineOptions) {
    const minecraft = new MinecraftFolder(this.getPath())
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(
      `/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`,
    )
    const downloadOptions = await this.app.registry.get(kDownloadOptions)

    this.log(`Install optifine ${version} on ${options.inheritFrom ?? options.mcversion}`)

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
        this.warn('Installing optifine over a fabric! This might not work!')
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
      // Track and download the installer
      await download({
        ...downloadOptions,
        url,
        destination: path,
        tracker: onDownloadSingle(ops.tracker as Tracker<LibrariesTrackerEvents>, 'libraries', {
          count: 1,
        }),
      })

      // Install optifine
      let id: string = await installOptifine(path, minecraft, ops)

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
        await ensureFile(dest)
        await writeFile(dest, JSON.stringify(json, null, 4))
        id = json.id
      }

      this.log(
        `Succeed to install optifine ${version} on ${options.inheritFrom ?? options.mcversion}. ${id}`,
      )

      task.complete()
      return id
    } catch (e) {
      task.fail(e)
      throw e
    }
  }

  async installByProfile(options: InstallProfileOptions) {
    const minecraftFolder = MinecraftFolder.from(this.getPath())
    const task = this.tasks.create<InstallProfileTask>({
      type: 'installProfile',
      key: options.version ?? options.profile.version,
      version: options.version ?? options.profile.version,
    })
    const ops = this.getInstallOptions({ side: options.side, java: options.java }, task)
    try {
      this.log(`Install by profile ${options.profile.version} (${options.side})`)
      await installByProfile(options.profile, minecraftFolder, ops)
      const json = join(
        minecraftFolder.getVersionRoot(options.profile.version),
        'install_profile.json',
      )
      await unlink(json).catch(() => {})
      this.log(`Successfully installed by profile ${options.profile.version} (${options.side})`)
      task.complete()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        task.fail(err)
        return
      }
      this.warn(`An error occurred during installing by profile ${options.profile.version} (${options.side}):`)
      this.warn(err)
      task.fail(err)
      if (options.profile.profile === 'NeoForge') {
        await this.installNeoForged({
          minecraft: options.profile.minecraft,
          version: options.profile.version.substring('neoforge-'.length),
          side: options.side,
          java: options.java,
        })
      } else {
        const forgeVersion =
          options.profile.version.indexOf('-forge-') !== -1
            ? options.profile.version.replace(/-forge-/, '-')
            : options.profile.version.indexOf('-forge') !== -1
              ? options.profile.version.replace(/-forge/, '-')
              : options.profile.version
        await this.installForge({
          version: forgeVersion,
          mcversion: options.profile.minecraft,
          side: options.side,
          java: options.java,
        })
      }
    }
  }

  async diagnose(options: DiagnoseOptions) {
    try {
      this.log(`Diagnose installation for ${options.currentVersion.id} (${options.side})`)
      const result = await completeInstallation(options.currentVersion, {
        side: options.side,
        diagnose: true,
        useHashForAssetsIndex: true,
        checksum: (file, algorithm) => this.resourceWorker.checksum(file, algorithm),
      }).catch((e) => {
        if (e instanceof InstallError) {
          return e.issue
        }
      })
      this.log(`Successfully diagnosed installation for ${options.currentVersion.id} (${options.side})`)
      return result || undefined
    } catch (e) {
      this.warn(`An error occurred during diagnosing installation for ${options.currentVersion.id} (${options.side}):`)
      this.warn(e)
      throw e
    }
  }
}
