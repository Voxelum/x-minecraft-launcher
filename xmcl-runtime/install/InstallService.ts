import { MinecraftFolder, ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import { DownloadBaseOptions, download } from '@xmcl/file-transfer'
import { DEFAULT_FORGE_MAVEN, DEFAULT_RESOURCE_ROOT_URL, InstallForgeOptions, InstallProfile, MinecraftVersion, Options, installAssets, installByProfile, installFabric, installForge, installJar, installLabyMod4, installLibraries, installNeoForged, installOptifine, installQuiltVersion, installResolvedAssets, installResolvedLibraries, installVersion } from '@xmcl/installer'
import { Asset, InstallService as IInstallService, InstallFabricOptions, InstallLabyModOptions, InstallNeoForgedOptions, InstallOptifineOptions, InstallQuiltOptions, InstallServiceKey, InstallableLibrary, LockKey, MutableState, Resource, ResourceDomain, Settings, TaskInstallAssets, TaskInstallForge, TaskInstallLabyMod, TaskInstallLibraries, TaskInstallNeoForged, TaskInstallOptifine, TaskInstallProfile, TaskInstallVersion, TaskRoutine, InstallForgeOptions as _InstallForgeOptions, isFabricLoaderLibrary, isForgeLibrary } from '@xmcl/runtime-api'
import { CancelledError } from '@xmcl/task'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { ensureFile, readFile, unlink, writeFile } from 'fs-extra'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { GFW } from '~/gfw'
import { JavaService } from '~/java'
import { kDownloadOptions } from '~/network'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { joinUrl } from '~/util/url'
import { VersionService } from '~/version'
import { AnyError } from '../util/error'
import { missing } from '../util/fs'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
@ExposeServiceKey(InstallServiceKey)
export class InstallService extends AbstractService implements IInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(JavaService) private javaService: JavaService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(GFW) private gfw: GFW,
    @Inject(kSettings) private settings: MutableState<Settings>,
    @Inject(kDownloadOptions) private downloadOptions: DownloadBaseOptions,
    @Inject(kTaskExecutor) private routine: TaskFn,
  ) {
    super(app)
  }

  #getForgeInstallOptions(task: TaskRoutine<any, any>, ops: InstallForgeOptions = {}): InstallForgeOptions {
    const options: InstallForgeOptions = {
      ...this.downloadOptions,
      onLibraryDownloadUpdate: (lib, progress) => {
        task.update(progress, 'library', { name: lib.name })
      },
      onForgeInstallerDownloadUpdate: (version, progress) => {
        task.update(progress, 'installer', { version })
      },
      onPostProcessUpdate: (proc, finished, total) => {
        task.update({ total, progress: finished, chunkSizeOrStatus: 0, file: proc.jar }, 'postProcess', { name: proc })
      },
      spawn: (cmd, args, opts) => {
        const a = args ? [...args] : []
        if (this.settings.httpProxy && this.settings.httpProxyEnabled) {
          const parsed = new URL(this.settings.httpProxy)
          if (parsed.hostname && parsed.port) {
            a.unshift(
              `-Dhttp.proxyHost=${parsed.hostname}`, `-Dhttp.proxyPort=${parsed.port}`,
              `-Dhttps.proxyHost=${parsed.hostname}`, `-Dhttps.proxyPort=${parsed.port}`,
            )
          } else {
            // use system proxy
            a.unshift(
              '-Djava.net.useSystemProxies=true',
            )
          }
        }
        return spawn(cmd, a, opts || {})
      },
      ...ops,
    }

    const allSets = getApiSets(this.settings)

    if (!shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      allSets.unshift({ name: 'mojang', url: '' })
    } else {
      allSets.push({ name: 'mojang', url: '' })
    }

    options.mavenHost = allSets.map(api => api.url ? `${api.url}/maven` : DEFAULT_FORGE_MAVEN)

    return options
  }

  #getInstallOptions(task: TaskRoutine<any, any>, ops: Options = {}): Options {
    const options: Options = {
      ...this.downloadOptions,
      ...ops,
      onJarDownloadUpdate: (version, progress) => {
        task.update(progress, 'jar', { id: version.id })
      },
      onJsonDownloadUpdate: (version, progress) => {
        task.update(progress, 'json', { id: version.id })
      },
      onAssetDownloadUpdate: (asset, progress) => {
        task.update(progress, 'asset', { asset: asset.name })
      },
      onAssetIndexDownloadUpdate: (index, progress) => {
        task.update(progress, 'assetIndex', { id: index.id })
      },
      onLogFileDownloadUpdate: (progress) => {
        // task.update(progress, 'assetIndex')
      },
      signal: task.signal,
    }

    const allSets = getApiSets(this.settings)

    if (!shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      allSets.unshift({ name: 'mojang', url: '' })
    } else {
      allSets.push({ name: 'mojang', url: '' })
    }

    options.assetsHost = allSets.map(api => api.url ? `${api.url}/assets` : DEFAULT_RESOURCE_ROOT_URL)
    options.libraryHost = (lib) => {
      const urls = allSets.map(api => {
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
    options.assetsIndexUrl = (ver) => allSets.map(api => {
      if (ver.assetIndex) {
        if (api.name === 'mojang') {
          return ver.assetIndex.url
        }
        const url = new URL(ver.assetIndex.url)
        const host = new URL(api.url).host
        url.host = host
        url.hostname = host
        return url.toString()
      }
      return ''
    }).filter(v => !!v)

    options.json = (ver) => allSets.map(api => {
      if (api.name === 'mojang') {
        return ver.url
      }
      const url = new URL(ver.url)
      const host = new URL(api.url).host
      url.host = host
      url.hostname = host
      return url.toString()
    })

    options.client = (ver) => allSets.map(api => {
      if (ver.downloads.client) {
        if (api.name === 'mojang') {
          return ver.downloads.client.url
        }
        const url = new URL(ver.downloads.client.url)
        const host = new URL(api.url).host
        url.host = host
        url.hostname = host
        return url.toString()
      }
      return ''
    }).filter(v => !!v)

    return options
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets, LockKey.libraries])
  async installDependencies(version: string, side = 'client') {
    const location = this.getPath()
    if (side === 'client') {
      const resolvedVersion = await Version.parse(location, version)
      const libTask = this.routine(TaskInstallLibraries, { id: resolvedVersion.id })
      await libTask.wrap(installLibraries(
        resolvedVersion,
        this.#getInstallOptions(libTask),
      ))
      const assetTask = this.routine(TaskInstallAssets, { id: resolvedVersion.id })
      await assetTask.wrap(installAssets(
        resolvedVersion,
        this.#getInstallOptions(assetTask),
      ))
    } else {
      const resolvedVersion = await this.versionService.resolveServerVersion(version)
      const task = this.routine(TaskInstallLibraries, { id: resolvedVersion.id })
      await task.wrap(installLibraries(
        {
          libraries: resolvedVersion.libraries,
          minecraftDirectory: location,
        },
        this.#getInstallOptions(task),
      ))
    }
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets])
  async installAssetsForVersion(version: string, fallbackVersionMetadata: MinecraftVersion[] = []) {
    const location = MinecraftFolder.from(this.getPath())
    try {
      // This special logic is handling the asset index outdate issue.
      // The asset index is not updated when the minecraft version is updated.
      let resolvedVersion = await Version.parse(location, version)
      let versionMeta = fallbackVersionMetadata.find(v => v.id === resolvedVersion.minecraftVersion)
      let unofficial = false
      if (!versionMeta) {
        versionMeta = fallbackVersionMetadata.find(v => v.id === resolvedVersion.assets)
        unofficial = true
      }
      if (versionMeta) {
        let sourceMinecraftVersion = version === resolvedVersion.minecraftVersion ? resolvedVersion : await Version.parse(location, resolvedVersion.minecraftVersion)
        if (!unofficial) {
          if (new Date(versionMeta.releaseTime) > new Date(sourceMinecraftVersion.releaseTime)) {
            // need update source version
            await this.installMinecraft(versionMeta)
            sourceMinecraftVersion = await Version.parse(location, versionMeta.id)
          }
          if (resolvedVersion.inheritances.length === 1 && resolvedVersion.inheritances[resolvedVersion.inheritances.length - 1] !== resolvedVersion.minecraftVersion) {
            // special packed version like PCL
            const jsonPath = location.getVersionJson(version)
            const rawContent = JSON.parse(await readFile(jsonPath, 'utf8'))
            rawContent.assetIndex = sourceMinecraftVersion.assetIndex
            await writeFile(jsonPath, JSON.stringify(rawContent))
            resolvedVersion = await Version.parse(location, version)
          }
        } else if (!resolvedVersion.assetIndex) {
          // custom
          let localVersion = await this.versionService.resolveLocalVersion(versionMeta.id).catch(() => undefined)
          if (!localVersion) {
            await this.installMinecraft(versionMeta)
            localVersion = await this.versionService.resolveLocalVersion(versionMeta.id)
          }
          resolvedVersion.assetIndex = localVersion.assetIndex
        }
      }
      this.log(`Install assets for ${version}:`)
      const jsonPath = location.getPath('assets', 'indexes', resolvedVersion.assets + '.json')
      const prevalidSizeOnly = existsSync(jsonPath)
      const task = this.routine(TaskInstallAssets, { id: version })
      const options = this.#getInstallOptions(task)
      await task.wrap(installAssets(resolvedVersion, { ...options, prevalidSizeOnly }))
    } catch (e) {
      this.warn(`An error ocurred during assets for ${version}:`)
      this.warn(e)
    }
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraft(meta: MinecraftVersion, side: 'client' | 'server' = 'client') {
    const id = meta.id
    try {
      const task = this.routine(TaskInstallVersion, { id })
      const options = this.#getInstallOptions(task, { side })
      await task.wrap(installVersion(meta, this.getPath(), options))
      return id
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
      throw e
    }
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraftJar(version: ResolvedVersion | string, side: 'client' | 'server' = 'client') {
    try {
      const parsed = typeof version === 'string' ? await this.versionService.resolveLocalVersion(version) : version
      const task = this.routine(TaskInstallVersion, { id: parsed.id })
      const options = this.#getInstallOptions(task, { side })
      await task.wrap(installJar(parsed, this.getPath(), options))
    } catch (e) {
      this.warn(`An error ocurred during download version ${version}`)
      this.warn(e)
    }
  }

  @Lock(LockKey.assets)
  async installAssets(assets: Asset[], version?: string, force?: boolean) {
    const task = this.routine(TaskInstallAssets, { id: version })
    const options = this.#getInstallOptions(task)
    const location = this.getPath()
    const folder = new MinecraftFolder(location)
    try {
      if (force) {
        // Remove assets before download
        const promises = [] as Promise<void>[]
        for (const a of assets) {
          const path = folder.getAsset(a.hash)
          if (path) {
            promises.push(unlink(path).catch(() => { }))
          }
        }
        await Promise.all(promises)
      }

      await task.wrap(installResolvedAssets(assets, folder, options))
    } catch (e) {
      this.warn('An error ocurred during install assets:')
      this.warn(e)
      throw e
    }
  }

  @Lock(LockKey.libraries)
  async installLibraries(libraries: InstallableLibrary[], version?: string, force?: boolean) {
    let resolved: ResolvedLibrary[]
    if ('downloads' in libraries[0]) {
      resolved = Version.resolveLibraries(libraries)
    } else {
      resolved = libraries as any
    }
    const folder = MinecraftFolder.from(this.getPath())
    try {
      if (force) {
        // remove lib before download
        const promises = [] as Promise<void>[]
        for (const lib of resolved) {
          const path = folder.getLibraryByPath(lib.path)
          if (path) {
            promises.push(unlink(path).catch(() => { }))
          }
        }
        await Promise.all(promises)
      }
      const task = this.routine(TaskInstallLibraries, { id: version })
      const options = this.#getInstallOptions(task)
      await task.wrap(installResolvedLibraries(resolved, folder, options))
    } catch (e) {
      this.warn('An error ocurred during install libraries:')
      this.warn(e)
    }
  }

  @Lock((v: InstallNeoForgedOptions) => LockKey.version(`neoforged-${v.minecraft}-${v.version}`))
  async installNeoForged(options: InstallNeoForgedOptions) {
    const validJavaPaths = this.javaService.getPreferredJava()

    for (const java of validJavaPaths) {
      try {
        this.log(`Start to install neoforge ${options.version} on ${options.minecraft} by ${java.path}`)

        const task = this.routine(TaskInstallNeoForged, { id: options.version })
        const installOptions = this.#getForgeInstallOptions(task)
        const version = await task.wrap(installNeoForged(
          options.version.startsWith(options.minecraft) ? 'forge' : 'neoforge',
          options.version,
          this.getPath(),
          installOptions,
        ))

        this.log(`Success to install neoforge ${options.version} on ${options.minecraft}`)

        return version
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.indexOf('sun.security.validator.ValidatorException') !== -1) {
            continue
          }
        }
        this.warn(`An error ocurred during download version ${options.version}@${options.minecraft}`)
        this.warn(err)
        throw err
      }
    }

    throw new AnyError('ForgeInstallError', `Cannot install forge ${options.version} on ${options.minecraft}`)
  }

  @Lock((v: _InstallForgeOptions) => LockKey.version(`forge-${v.minecraft}-${v.version}`))
  async installForge(options: _InstallForgeOptions) {
    const side = options.side ?? 'client'

    const task = this.routine(TaskInstallForge, { id: options.version })
    const javas = this.javaService.getPreferredJava()
    for (const java of javas) {
      try {
        this.log(`Start to install forge ${options.version} on ${options.minecraft} by ${java.path}`)
        const mc = MinecraftFolder.from(this.getPath())

        const installOptions = this.#getForgeInstallOptions(task, {
          side,
          java: java.path,
          inheritsFrom: options.minecraft,
        })

        const version = await installForge(options, mc, installOptions)

        this.log(`Success to install forge ${options.version} on ${options.minecraft}`)

        task.resolve()
        return version
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.indexOf('sun.security.validator.ValidatorException') !== -1) {
            continue
          }
        }
        task.reject(err)
        this.warn(`An error ocurred during download version ${options.version}@${options.minecraft}`)
        this.warn(err)
        throw err
      }
    }

    throw new AnyError('ForgeInstallError', `Cannot install forge ${options.version} on ${options.minecraft}`)
  }

  @Lock((v: InstallProfile) => LockKey.version(v.version))
  async installByProfile(profile: InstallProfile, side: 'client' | 'server' = 'client') {
    const javas = this.javaService.getPreferredJava()
    const java = javas[0]
    try {
      const task = this.routine(TaskInstallProfile, { id: profile.version })
      const options = this.#getForgeInstallOptions(task, {
        java: java.path,
        side,
      })
      await task.wrap(installByProfile(profile, this.getPath(), options))
    } catch (err) {
      if (err instanceof CancelledError) {
        return
      }
      const forgeVersion = profile.version.indexOf('-forge-') !== -1
        ? profile.version.replace(/-forge-/, '-')
        : profile.version.indexOf('-forge') !== -1
          ? profile.version.replace(/-forge/, '-')
          : profile.version
      await this.installForge({
        version: forgeVersion,
        minecraft: profile.minecraft,
        side,
      })
      this.warn(err)
    }
  }

  @Lock((v: InstallFabricOptions) => LockKey.version(`fabric-${v.minecraft}-${v.loader}`))
  async installFabric(options: InstallFabricOptions) {
    try {
      this.log(`Start to install fabric: loader ${options.loader}.`)
      const path = this.getPath()

      const versionId = await installFabric({
        side: options.side,
        minecraftVersion: options.minecraft,
        minecraft: path,
        version: options.loader,
        fetch: this.app.fetch,
      })

      this.log(`Success to install fabric: loader ${options.loader}. The new version is ${versionId}`)
      return versionId
    } catch (e) {
      this.warn(`An error ocurred during install fabric loader-${options.loader}`)
      this.warn(e)
      throw e
    }
  }

  @Lock(v => LockKey.version(`quilt-${v.minecraftVersion}-${v.version}`))
  async installQuilt(options: InstallQuiltOptions) {
    try {
      this.log(`Start to install quilt: version ${options.version}.`)
      const path = this.getPath()

      const versionId = await installQuiltVersion({
        side: options.side,
        minecraft: path,
        minecraftVersion: options.minecraftVersion,
        version: options.version,
        fetch: this.app.fetch,
      })

      return versionId
    } catch (e) {
      this.warn(`An error ocurred during install quilt ${options.version}`)
      this.warn(e)
      throw e
    }
  }

  async installOptifineAsResource(options: InstallOptifineOptions) {
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(`/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`)
    const resourceService = this.resourceService
    if (await missing(path)) {
      const urls = getApiSets(this.settings).map(a => `${a.url}/optifine/${options.mcversion}/${options.type}/${options.patch}`)
      const downloadOptions = this.downloadOptions
      const task = this.routine(TaskInstallOptifine)
      await task.wrap(download({
        ...downloadOptions,
        url: urls,
        destination: path,
        progressController: (url, chunkSize, written, total) => {
          task.update({
            url,
            chunkSizeOrStatus: chunkSize,
            progress: written,
            total,
          })
        },
      }))
    }
    const [resource] = await resourceService.importResources([{ path, domain: ResourceDomain.Mods }])
    return resource
  }

  @Lock((v: InstallOptifineOptions) => LockKey.version(`optifine-${v.mcversion}-${v.type}_${v.patch}`))
  async installOptifine(options: InstallOptifineOptions) {
    const minecraft = new MinecraftFolder(this.getPath())
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(`/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`)
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

    const urls = getApiSets(this.settings).map(a => `${a.url}/optifine/${options.mcversion}/${options.type}/${options.patch}`)

    const task = this.routine(TaskInstallOptifine)
    await task.wrap(download({
      ...downloadOptions,
      url: urls,
      destination: path,
      progressController: (url, chunkSize, written, total) => {
        task.update({
          url,
          chunkSizeOrStatus: chunkSize,
          progress: written,
          total,
        })
      },
    }))

    const resources = await this.resourceService.importResources([{ path, domain: ResourceDomain.Mods }])

    const java = this.javaService.getPreferredJava()
    let id: string = await installOptifine(path, minecraft, { java: java[0].path })
    if (options.inheritFrom) {
      const parentJson: Version = JSON.parse(await readFile(minecraft.getVersionJson(options.inheritFrom), 'utf8'))
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

    this.log(`Succeed to install optifine ${version} on ${options.inheritFrom ?? options.mcversion}. ${resources[0]}`)

    return [id, resources[0]] as [string, Resource]
  }

  @Lock((v) => [LockKey.version(v.minecraftVersion)])
  async installLabyModVersion(options: InstallLabyModOptions) {
    const location = this.getPath()
    const task = this.routine(TaskInstallLabyMod, { version: options.manifest.labyModVersion })
    const version = await task.wrap(installLabyMod4(
      options.manifest,
      options.minecraftVersion,
      location,
      {
        ...this.downloadOptions,
        fetch: this.app.fetch,
        onLabyModAssetDownloadUpdate: (name, progress) => {
          task.update(progress, 'asset', { name })
        },
      },
    ))
    return version
  }

  @Lock(v => [LockKey.version(v)])
  async reinstall(version: string) {
    // const option = this.getInstallOptions()
    // const location = this.getPath()
    // const local = await this.versionService.resolveLocalVersion(version)
    // if (!local) {
    //   throw new AnyError('ReinstallError', `Cannot reinstall ${version} as it's not found!`)
    // }
    // const installVersionRoutine = this.routine('installVersion')
    // await this.submit(installVersion({ id: local.minecraftVersion, url: '' }, location).setName('installVersion', { id: local.minecraftVersion }))
    // const forgeLib = local.libraries.find(isForgeLibrary)
    // if (forgeLib) {
    //   await this.submit(installForgeTask({ version: forgeLib.version, mcversion: local.minecraftVersion }, location).setName('installForge', { id: version }))
    // }
    // const fabLib = local.libraries.find(isFabricLoaderLibrary)
    // if (fabLib) {
    //   await this.installFabric({ minecraft: local.minecraftVersion, loader: fabLib.version })
    // }
    // await this.submit(installLibrariesTask(local, option).setName('installLibraries', { id: version }))
    // await this.submit(installAssetsTask(local, option).setName('installAssets', { id: version }))
  }
}
