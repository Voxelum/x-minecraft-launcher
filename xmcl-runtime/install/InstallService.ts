import { checksum, MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core'
import { DownloadBaseOptions } from '@xmcl/file-transfer'
import { DEFAULT_FORGE_MAVEN, DEFAULT_RESOURCE_ROOT_URL, DownloadTask, InstallForgeOptions, InstallJarTask, InstallProfile, LiteloaderVersion, MinecraftVersion, Options, installAssetsTask, installByProfileTask, installFabric, installForgeTask, installLabyMod4Task, installLibrariesTask, installLiteloaderTask, installNeoForgedTask, installOptifineTask, installQuiltVersion, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask } from '@xmcl/installer'
import { Asset, InstallService as IInstallService, InstallFabricOptions, InstallLabyModOptions, InstallNeoForgedOptions, InstallOptifineOptions, InstallQuiltOptions, InstallServiceKey, InstallableLibrary, LockKey, MutableState, Resource, ResourceDomain, Settings, InstallForgeOptions as _InstallForgeOptions, isFabricLoaderLibrary, isForgeLibrary } from '@xmcl/runtime-api'
import { CancelledError, task } from '@xmcl/task'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { ensureFile, readFile, readFileSync, unlink, writeFile } from 'fs-extra'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { GFW } from '~/gfw'
import { JavaService } from '~/java'
import { kDownloadOptions } from '~/network'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, Lock, Singleton } from '~/service'
import { getApiSets, kSettings, shouldOverrideApiSet } from '~/settings'
import { TaskFn, kTaskExecutor } from '~/task'
import { joinUrl, replaceHost } from '~/util/url'
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
    @Inject(kTaskExecutor) private submit: TaskFn,
  ) {
    super(app)
  }

  protected getForgeInstallOptions(): InstallForgeOptions {
    const options: InstallForgeOptions = {
      ...this.downloadOptions,
      java: this.javaService.getPreferredJava()?.path,
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
      handler: async (postProcessor) => {
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
        const task = parsedArgs.task

        if (task !== 'DOWNLOAD_MOJMAPS') return false
        if (!parsedArgs.version || !parsedArgs.side || !parsedArgs.output) return false

        const versionContent = await readFile(this.getPath('versions', parsedArgs.version, `${parsedArgs.version}.json`), 'utf-8').catch(() => '')
        if (!versionContent) return false

        const version: Version = JSON.parse(versionContent)
        const mapping = version.downloads?.[`${parsedArgs.side}_mappings`]
        if (!mapping) return false

        const output = parsedArgs.output
        const url = new URL(mapping.url)
        const urls = allSets.map(api => {
          if (api.name === 'mojang') {
            return url.toString()
          }
          return replaceHost(url, api.url)
        })
        const sha1 = await checksum(output, 'sha1')
        if (sha1 === mapping.sha1) {
          return true
        }
        for (const u of urls) {
          try {
            const response = await this.app.fetch(u)
            const text = await response.text()
            await writeFile(output, text)
            return true
          } catch (e) {
            this.warn(`Failed to download mojmap from ${u}`)
          }
        }
        return false
      },
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

  protected getInstallOptions(): Options {
    const option: Options = {
      assetsDownloadConcurrency: 16,
      ...this.downloadOptions,
      side: 'client',
    }

    const allSets = getApiSets(this.settings)

    if (!shouldOverrideApiSet(this.settings, this.gfw.inside)) {
      allSets.unshift({ name: 'mojang', url: '' })
    } else {
      allSets.push({ name: 'mojang', url: '' })
    }

    option.assetsHost = allSets.map(api => api.url ? `${api.url}/assets` : DEFAULT_RESOURCE_ROOT_URL)
    option.libraryHost = (lib) => {
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
    option.assetsIndexUrl = (ver) => allSets.map(api => {
      if (ver.assetIndex) {
        if (api.name === 'mojang') {
          return ver.assetIndex.url
        }
        return replaceHost(ver.assetIndex.url, api.url)
      }
      return ''
    }).filter(v => !!v)

    option.json = (ver) => allSets.map(api => {
      if (api.name === 'mojang') {
        return ver.url
      }
      return replaceHost(ver.url, api.url)
    })

    option.client = (ver) => allSets.map(api => {
      if (ver.downloads.client) {
        if (api.name === 'mojang') {
          return ver.downloads.client.url
        }
        return replaceHost(ver.downloads.client.url, api.url)
      }
      return ''
    }).filter(v => !!v)

    return option
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets])
  async installAssetsForVersion(version: string, fallbackVersionMetadata: MinecraftVersion[] = []) {
    const option = this.getInstallOptions()
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
      await this.submit(installAssetsTask(resolvedVersion, { ...option, prevalidSizeOnly }).setName('installAssets', { id: version }))
    } catch (e) {
      this.warn(`An error ocurred during assets for ${version}:`)
      this.warn(e)
    }
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets, LockKey.libraries])
  async installDependencies(version: string, side = 'client') {
    const location = this.getPath()
    const option = this.getInstallOptions()
    if (side === 'client') {
      const resolvedVersion = await Version.parse(location, version)
      await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries', { id: resolvedVersion.id }))
      await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets', { id: resolvedVersion.id }))
    } else {
      const resolvedVersion = await this.versionService.resolveServerVersion(version)
      await this.submit(installLibrariesTask({
        libraries: resolvedVersion.libraries,
        minecraftDirectory: location,
      }, option).setName('installLibraries', { id: resolvedVersion.id }))
    }
  }

  @Lock((v) => [LockKey.version(v.minecraftVersion)])
  async installLabyModVersion(options: InstallLabyModOptions) {
    const location = this.getPath()
    const task = installLabyMod4Task(options.manifest, options.minecraftVersion, location, this.getInstallOptions()).setName('installLabyMod', { version: options.manifest.labyModVersion })
    const version = await this.submit(task)
    return version
  }

  @Lock(v => [LockKey.version(v)])
  async reinstall(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const local = await this.versionService.resolveLocalVersion(version)
    if (!local) {
      throw new AnyError('ReinstallError', `Cannot reinstall ${version} as it's not found!`)
    }
    await this.submit(installVersionTask({ id: local.minecraftVersion, url: '' }, location).setName('installVersion', { id: local.minecraftVersion }))
    const forgeLib = local.libraries.find(isForgeLibrary)
    if (forgeLib) {
      await this.submit(installForgeTask({ version: forgeLib.version, mcversion: local.minecraftVersion }, location).setName('installForge', { id: version }))
    }
    const fabLib = local.libraries.find(isFabricLoaderLibrary)
    if (fabLib) {
      await this.installFabric({ minecraft: local.minecraftVersion, loader: fabLib.version })
    }
    await this.submit(installLibrariesTask(local, option).setName('installLibraries', { id: version }))
    await this.submit(installAssetsTask(local, option).setName('installAssets', { id: version }))
  }

  @Lock(LockKey.assets)
  async installAssets(assets: Asset[], version?: string, force?: boolean) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const folder = new MinecraftFolder(location)
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
    const task = installResolvedAssetsTask(assets, folder, option).setName('installAssets', { id: version })
    await this.submit(task)
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraft(meta: MinecraftVersion, side: 'client' | 'server' = 'client') {
    const id = meta.id

    const option = this.getInstallOptions()
    const task = installVersionTask(meta, this.getPath(), { ...option, side }).setName('installVersion', { id: meta.id })
    try {
      await this.submit(task)
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
    }
  }

  @Lock((v: string) => LockKey.version(v))
  async installMinecraftJar(version: string, side?: 'client' | 'server') {
    const option = this.getInstallOptions()
    option.side = side ?? 'client'
    const folder = MinecraftFolder.from(this.getPath())
    const parsed = await this.versionService.resolveLocalVersion(version)
    try {
      await this.submit(new InstallJarTask(parsed, folder, option).setName('installVersion.jar'))
    } catch (e) {
      this.warn(`An error ocurred during download server version ${version}`)
      this.warn(e)
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
    const option = this.getInstallOptions()
    const folder = MinecraftFolder.from(this.getPath())
    const task = installResolvedLibrariesTask(resolved, folder, option).setName('installLibraries', { id: version })
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
      await this.submit(task)
    } catch (e) {
      this.warn('An error ocurred during install libraries:')
      this.warn(e)
    }
  }

  @Lock((v: InstallNeoForgedOptions) => LockKey.version(`neoforged-${v.minecraft}-${v.version}`))
  async installNeoForged(options: InstallNeoForgedOptions) {
    const validJavaPaths = this.javaService.state.all.filter(v => v.valid)
    const installOptions = this.getForgeInstallOptions()

    validJavaPaths.sort((a, b) => a.majorVersion === 8 ? -1 : b.majorVersion === 8 ? 1 : -1)

    let version: string | undefined
    for (const java of validJavaPaths) {
      try {
        this.log(`Start to install neoforge ${options.version} on ${options.minecraft} by ${java.path}`)
        version = await this.submit(installNeoForgedTask(options.version.startsWith(options.minecraft) ? 'forge' : 'neoforge', options.version, this.getPath(), {
          ...installOptions,
          java: java.path,
          inheritsFrom: options.minecraft,
          side: options.side,
        }).setName('installForge', { id: options.version }))
        this.log(`Success to install neoforge ${options.version} on ${options.minecraft}`)
        break
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
    if (!version) {
      throw new AnyError('ForgeInstallError', `Cannot install forge ${options.version} on ${options.minecraft}`)
    }
    return version
  }

  @Lock((v: _InstallForgeOptions) => LockKey.version(`forge-${v.mcversion}-${v.version}`))
  async installForge(options: _InstallForgeOptions) {
    const validJavaPaths = this.javaService.state.all.filter(v => v.valid)
    const installOptions = this.getForgeInstallOptions()
    const side = options.side ?? 'client'

    validJavaPaths.sort((a, b) => a.majorVersion === 8 ? -1 : b.majorVersion === 8 ? 1 : -1)
    const setting = await this.app.registry.get(kSettings)

    let version: string | undefined
    for (const java of validJavaPaths) {
      try {
        this.log(`Start to install forge ${options.version} on ${options.mcversion} by ${java.path}`)
        const mc = MinecraftFolder.from(this.getPath())
        version = await this.submit(installForgeTask(options, mc, {
          ...installOptions,
          java: java.path,
          side,
          inheritsFrom: options.mcversion,
          spawn: (cmd, args) => {
            const newArgs = args ? [...args] : []
            const proxy = setting.httpProxyEnabled ? setting.httpProxy : undefined
            if (proxy) {
              const url = new URL(proxy)
              newArgs.unshift(
                `-Dhttp.proxyHost=${url.hostname}`,
                `-Dhttp.proxyPort=${url.port}`,
                `-Dhttps.proxyHost=${url.hostname}`,
                `-Dhttps.proxyPort=${url.port}`,
              )
            } else {
              newArgs.unshift('-Djava.net.useSystemProxies=true')
            }
            return spawn(cmd, args)
          },
        }).setName('installForge', { id: options.version }))

        this.log(`Success to install forge ${options.version} on ${options.mcversion}`)
        break
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.indexOf('sun.security.validator.ValidatorException') !== -1) {
            continue
          }
        }
        this.warn(`An error ocurred during download version ${options.version}@${options.mcversion}`)
        this.warn(err)
        throw err
      }
    }
    if (!version) {
      throw new AnyError('ForgeInstallError', `Cannot install forge ${options.version} on ${options.mcversion}`)
    }
    return version
  }

  @Lock((v: InstallFabricOptions) => LockKey.version(`fabric-${v.minecraft}-${v.loader}`))
  async installFabric(options: InstallFabricOptions) {
    try {
      this.log(`Start to install fabric: yarn ${options.yarn}, loader ${options.loader}.`)
      const path = this.getPath()
      const apiSets = getApiSets(this.settings).map(a => a.url)
      const preferDefault = shouldOverrideApiSet(this.settings, this.gfw.inside)

      const versionId = await installFabric({
        minecraft: path,
        minecraftVersion: options.minecraft,
        side: options.side,
        version: options.loader,
        fetch: (i, init) => {
          const url = new URL(i)
          const apis = apiSets.map(a => a + '/fabric-meta')
          if (preferDefault) {
            apis.unshift(url.protocol + '//' + url.host)
          } else {
            apis.push(url.protocol + '//' + url.host)
          }
          const urls = apis.map(a => new URL(a)).map(a => {
            const realUrl = new URL(url.toString())
            realUrl.host = a.host
            realUrl.pathname = (a.pathname === '/' ? '' : a.pathname) + url.pathname
            return realUrl.toString()
          })
          return Promise.any(urls.map(async (a) => {
            const resp = await this.app.fetch(a, init)
            if (resp.ok) {
              return resp
            }
            throw new Error(`Failed to fetch ${a}`)
          }))
        },
      })
      this.log(`Success to install fabric: yarn ${options.yarn}, loader ${options.loader}. The new version is ${versionId}`)
      return versionId
    } catch (e) {
      this.warn(`An error ocurred during install fabric yarn-${options.yarn}, loader-${options.loader}`)
      this.warn(e)
      throw e
    }
  }

  @Lock(v => LockKey.version(`quilt-${v.minecraftVersion}-${v.version}`))
  async installQuilt(options: InstallQuiltOptions) {
    const side = options.side ?? 'client'
    const mc = MinecraftFolder.from(this.getPath())
    const apiSets = getApiSets(this.settings).map(a => a.url)
    const preferDefault = shouldOverrideApiSet(this.settings, this.gfw.inside)
    const version = await installQuiltVersion({
      minecraft: mc,
      minecraftVersion: options.minecraftVersion,
      version: options.version,
      side,
      fetch: (i, init) => {
        const url = new URL(i)
        const apis = apiSets.map(a => a + '/quilt-meta')
        if (preferDefault) {
          apis.unshift(url.protocol + '//' + url.host)
        } else {
          apis.push(url.protocol + '//' + url.host)
        }
        const urls = apis.map(a => new URL(a)).map(a => {
          const realUrl = new URL(url.toString())
          realUrl.host = a.host
          realUrl.pathname = (a.pathname === '/' ? '' : a.pathname) + url.pathname
          return realUrl.toString()
        })
        return Promise.any(urls.map(async (a) => {
          const resp = await this.app.fetch(a, init)
          if (resp.ok) {
            return resp
          }
          throw new Error(`Failed to fetch ${a}`)
        }))
      },
    })
    return version
  }

  async installOptifineAsResource(options: InstallOptifineOptions) {
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(`/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`)
    const resourceService = this.resourceService
    if (await missing(path)) {
      const urls = [] as string[]
      if (getApiSets(this.settings)[0].name === 'bmcl') {
        urls.push(
          `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
        )
      }
      const downloadOptions = this.downloadOptions
      await this.submit(task('installOptifine', async function () {
        await this.yield(new DownloadTask({
          ...downloadOptions,
          url: urls,
          destination: path,
        }).setName('download'))
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

    const java = this.javaService.getPreferredJava()?.path
    const resourceService = this.resourceService
    const error = this.error

    const urls = [] as string[]
    if (getApiSets(this.settings)[0].name === 'mcbbs') {
      urls.push(
        `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
      )
    } else {
      urls.push(
        `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
      )
    }
    const result = await this.submit(task('installOptifine', async function () {
      await this.yield(new DownloadTask({
        ...downloadOptions,
        url: urls,
        destination: path,
      }).setName('download'))
      const resources = await resourceService.importResources([{ path, domain: ResourceDomain.Mods }])
      let id: string = await this.concat(installOptifineTask(path, minecraft, { java }))

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
      return [id, resources[0]] as [string, Resource]
    }, { id: optifineVersion }))

    this.log(`Succeed to install optifine ${version} on ${options.inheritFrom ?? options.mcversion}. ${result[0]}`)

    return result
  }

  @Singleton()
  async installLiteloader(meta: LiteloaderVersion) {
    try {
      await this.submit(installLiteloaderTask(meta, this.getPath()))
    } catch (err) {
      this.warn(err)
    }
  }

  async installByProfile(profile: InstallProfile, version?: string) {
    try {
      await this.submit(installByProfileTask(profile, this.getPath(), {
        ...this.getForgeInstallOptions(),
      }).setName('installForge', { id: version ?? profile.version }))
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
        mcversion: profile.minecraft,
      })
      this.warn(err)
    }
  }
}
