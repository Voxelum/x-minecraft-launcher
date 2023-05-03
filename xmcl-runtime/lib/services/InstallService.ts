import { diagnose, diagnoseLibraries, LibraryIssue, MinecraftFolder, ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import { parse as parseForge } from '@xmcl/forge-site-parser'
import { DEFAULT_FORGE_MAVEN, DEFAULT_RESOURCE_ROOT_URL, DEFAULT_VERSION_MANIFEST_URL, DownloadTask, FabricArtifactVersion, getFabricLoaderArtifact, installAssetsTask, installByProfileTask, installFabric, InstallForgeOptions, installForgeTask, InstallJarTask, installLibrariesTask, installLiteloaderTask, installOptifineTask, InstallProfile, installQuiltVersion, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask, LiteloaderVersion, MinecraftVersion, MinecraftVersionList, Options, QuiltArtifactVersion } from '@xmcl/installer'
import { Asset, FabricVersions, ForgeVersion, GetQuiltVersionListOptions, InstallableLibrary, InstallFabricOptions, InstallForgeOptions as _InstallForgeOptions, InstallOptifineOptions, InstallQuiltOptions, InstallService as IInstallService, InstallServiceKey, isFabricLoaderLibrary, isForgeLibrary, LiteloaderVersions, LockKey, MinecraftVersions, OptifineVersion, ResourceDomain } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { ensureFile } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import { request } from 'undici'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { assertErrorWithCache, kCacheKey } from '../dispatchers/cacheDispatcher'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { JavaService } from './JavaService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Lock, Singleton } from './Service'
import { VersionService } from './VersionService'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
@ExposeServiceKey(InstallServiceKey)
export class InstallService extends AbstractService implements IInstallService {
  private latestRelease = '1.19.2'

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(JavaService) private javaService: JavaService,
  ) {
    super(app, async () => {
      await this.networkManager.gfwReady.promise
      this.getFabricVersionList()
      this.getMinecraftVersionList()
      this.getOptifineVersionList()
    })

    this.app.networkManager.registerDispatchInterceptor((options) => {
      if (options.skipOverride) {
        return
      }
      const origin = options.origin instanceof URL ? options.origin : new URL(options.origin!)
      if (origin.host === 'meta.fabricmc.net') {
        if (this.baseService.shouldOverrideApiSet()) {
          const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference) || this.baseService.state.apiSets[0]
          const url = new URL(api.url + '/fabric-meta' + options.path)
          options.origin = url.origin
          options.path = url.pathname + url.search
        }
      } else if (origin.host === 'launchermeta.mojang.com') {
        if (this.baseService.shouldOverrideApiSet()) {
          const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference) || this.baseService.state.apiSets[0]
          options.origin = new URL(api.url).origin
        }
      } else if (origin.host === 'bmclapi2.bangbang93.com' || origin.host === 'bmclapi.bangbang93.com') {
        // bmclapi might have mirror
        if (this.baseService.shouldOverrideApiSet()) {
          const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference) || this.baseService.state.apiSets[0]
          options.origin = new URL(api.url).origin
        }
      } else if (origin.host === 'files.minecraftforge.net' && options.path.startsWith('/maven/net/minecraftforge/forge/') && options.path.endsWith('.html')) {
        const mcVersion = options.path.substring(options.path.lastIndexOf('_') + 1, options.path.lastIndexOf('.'))
        if (this.baseService.shouldOverrideApiSet()) {
          const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference) || this.baseService.state.apiSets[0]
          // Override to BCMLAPI
          options.origin = new URL(api.url).origin
          options.path = `/forge/minecraft/${mcVersion}`
        }
      }
    })
  }

  getLatestRelease() {
    return this.latestRelease
  }

  @Singleton()
  async getMinecraftVersionList(force?: boolean): Promise<MinecraftVersions> {
    this.log('Start to refresh minecraft version metadata.')
    let metadata: MinecraftVersionList

    try {
      const response = await request(DEFAULT_VERSION_MANIFEST_URL)

      if (response.statusCode === 304) {
        this.log('Not found new Minecraft version metadata. Use cache.')
      } else {
        this.log('Found new minecraft version metadata. Update it.')
      }

      metadata = await response.body.json()
    } catch (e) {
      assertErrorWithCache(e)
      metadata = JSON.parse(e[kCacheKey].getBody().toString())
    }

    this.latestRelease = metadata.latest.release
    return metadata
  }

  @Singleton()
  async getForgeVersionList(options: { force?: boolean; minecraftVersion: string }): Promise<ForgeVersion[]> {
    const { minecraftVersion, force } = options

    if (!minecraftVersion) {
      throw new Error('Empty Minecraft Version')
    }

    try {
      let versions: ForgeVersion[]
      const response = await request(`http://files.minecraftforge.net/net/minecraftforge/forge/index_${minecraftVersion}.html`, {
        maxRedirections: 2,
      })
      if (typeof response.headers['content-type'] === 'string' && response.headers['content-type']?.startsWith('application/json')) {
        interface BMCLForge {
          'branch': string // '1.9';
          'build': string // 1766;
          'mcversion': string // '1.9';
          'modified': string // '2016-03-18T07:44:28.000Z';
          'version': string // '12.16.0.1766';
          files: {
            format: 'zip' | 'jar' // zip
            category: 'universal' | 'mdk' | 'installer'
            hash: string
          }[]
        }
        const bmclVersions: BMCLForge[] = await response.body.json()
        versions = bmclVersions.map(v => ({
          mcversion: v.mcversion,
          version: v.version,
          type: 'common',
          date: v.modified,
        }))
      } else {
        const text = await response.body.text()
        const htmlVersions = parseForge(text)
        versions = htmlVersions.versions.map(v => {
          return {
            mcversion: minecraftVersion,
            version: v.version,
            date: v.date,
            type: v.type,
            changelog: v.changelog,
            installer: v.installer,
            mdk: v.mdk,
            universal: v.universal,
            source: v.source,
            launcher: v.launcher,
            'installer-win': v['installer-win'],
          }
        })
      }

      return versions
    } catch (e) {
      this.error(`Fail to fetch forge info of ${minecraftVersion}`)
      this.error(e)
      throw e
    }
  }

  @Singleton()
  async getLiteloaderVersionList(force?: boolean): Promise<LiteloaderVersions> {
    throw new Error()
    // if (!force && this.refreshedLiteloader) {
    //   return this.liteloaderVersionJson.read()
    // }

    // const oldData = await this.liteloaderVersionJson.read()
    // const option = oldData.timestamp === ''
    //   ? undefined
    //   : {
    //     original: oldData,
    //   }
    // const remoteList = await getLiteloaderVersionList(option)
    // if (remoteList !== oldData) {
    //   this.liteloaderVersionJson.write(remoteList)
    // }

    // this.refreshedLiteloader = true
    // return remoteList
  }

  @Singleton()
  async getFabricVersionList(force?: boolean): Promise<FabricVersions> {
    this.log('Start to refresh fabric metadata')

    let yarns: FabricArtifactVersion[]
    try {
      const response = await request('https://meta.fabricmc.net/v2/versions/yarn')
      yarns = await response.body.json()
      if (response.statusCode === 304) {
        this.log('Not found new fabric yarn metadata. Use cache')
      } else {
        this.log(`Found new fabric yarn metadata: ${response.headers['last-modified']}.`)
      }
    } catch (e) {
      assertErrorWithCache(e)
      yarns = e[kCacheKey].getBodyJson() || []
    }

    let loaders: FabricArtifactVersion[]
    try {
      const response = await request('https://meta.fabricmc.net/v2/versions/loader')
      loaders = await response.body.json()
      if (response.statusCode === 304) {
        this.log('Not found new fabric loader metadata. Use cache')
      } else {
        this.log(`Found new fabric loader metadata: ${response.headers['last-modified']}.`)
      }
    } catch (e) {
      assertErrorWithCache(e)
      loaders = e[kCacheKey].getBodyJson() || []
    }

    return {
      loaders,
      yarns,
    }
  }

  @Singleton()
  async getOptifineVersionList(force?: boolean): Promise<OptifineVersion[]> {
    this.log('Start to refresh optifine metadata')

    let versions: OptifineVersion[]
    try {
      const response = await request('https://bmclapi2.bangbang93.com/optifine/versionList')
      if (response.statusCode === 304) {
        this.log('Not found new optifine version metadata. Use cache.')
      } else {
        this.log('Found new optifine version metadata. Update it.')
      }
      versions = await response.body.json()
    } catch (e) {
      assertErrorWithCache(e)
      versions = e[kCacheKey].getBodyJson() || []
    }

    return versions
  }

  @Singleton()
  async getQuiltVersionList(options?: GetQuiltVersionListOptions): Promise<QuiltArtifactVersion[]> {
    const hasMinecraft = async () => {
      if (options?.minecraftVersion) {
        const url = `https://meta.fabricmc.net/v2/versions/intermediary/${options?.minecraftVersion}`
        const response = await request(url)
        if (response.statusCode === 200) {
          return (await response.body.json()).length > 0
        } else if (response.statusCode === 304) {
          return (await response.body.json()).length > 0
        }
        return false
      }
      return true
    }
    this.log('Start to get quilt metadata')
    let versions: QuiltArtifactVersion[]
    try {
      const { body, statusCode } = await request('https://meta.quiltmc.org/v3/versions/loader')
      if (statusCode >= 400) {
        throw new Error()
      }
      versions = await body.json()
      if (statusCode === 200) {
        this.log('Found new quilt metadata')
      } else if (statusCode === 304) {
        this.log('Use existed quilt metadata')
      }
    } catch (e) {
      assertErrorWithCache(e)
      versions = e[kCacheKey].getBodyJson() || []
    }

    if (await hasMinecraft()) {
      return versions
    }

    return []
  }

  protected getForgeInstallOptions(): InstallForgeOptions {
    const options: InstallForgeOptions = {
      ...this.networkManager.getDownloadBaseOptions(),
      java: this.javaService.getPreferredJava()?.path,
    }

    const allSets = this.baseService.getApiSets()

    if (!this.baseService.shouldOverrideApiSet()) {
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
      ...this.networkManager.getDownloadBaseOptions(),
      side: 'client',
    }

    const allSets = this.baseService.getApiSets()

    if (!this.baseService.shouldOverrideApiSet()) {
      allSets.unshift({ name: 'mojang', url: '' })
    } else {
      allSets.push({ name: 'mojang', url: '' })
    }

    option.assetsHost = allSets.map(api => api.url ? `${api.url}/assets` : DEFAULT_RESOURCE_ROOT_URL)
    option.mavenHost = allSets.map(api => api.url ? `${api.url}/maven` : DEFAULT_FORGE_MAVEN)
    option.assetsIndexUrl = (ver) => allSets.map(api => {
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

    option.json = (ver) => allSets.map(api => {
      if (api.name === 'mojang') {
        return ver.url
      }
      const url = new URL(ver.url)
      const host = new URL(api.url).host
      url.host = host
      url.hostname = host
      return url.toString()
    })

    option.client = (ver) => allSets.map(api => {
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

    return option
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets])
  async installAssetsForVersion(version: string) {
    const option = this.getInstallOptions()
    const location = MinecraftFolder.from(this.getPath())
    try {
      // this special logic is handling the asset index outdate issue.
      let resolvedVersion = await Version.parse(location, version)
      const list = await this.getMinecraftVersionList(true)
      let versionMeta = list.versions.find(v => v.id === resolvedVersion.minecraftVersion)
      let unofficial = false
      if (!versionMeta) {
        versionMeta = list.versions.find(v => v.id === resolvedVersion.assets)
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
      this.warn(`Install assets for ${version}:`)
      await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets', { id: version }))
    } catch (e) {
      this.warn(`An error ocurred during assets for ${version}:`)
      this.warn(e)
    }
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets, LockKey.libraries])
  async installDependencies(version: string) {
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.installDependenciesUnsafe(resolvedVersion)
  }

  @Lock((v) => [LockKey.version(v.id), LockKey.assets, LockKey.libraries])
  async installDependenciesResolved(resolvedVersion: ResolvedVersion) {
    await this.installDependenciesUnsafe(resolvedVersion)
  }

  private async installDependenciesUnsafe(resolvedVersion: ResolvedVersion) {
    const option = this.getInstallOptions()
    await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries', { id: resolvedVersion.id }))
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets', { id: resolvedVersion.id }))
  }

  @Lock(v => [LockKey.version(v)])
  async reinstall(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const local = await this.versionService.resolveLocalVersion(version)
    if (!local) {
      throw new Error(`Cannot reinstall ${version} as it's not found!`)
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
  async installAssets(assets: Asset[], version?: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const task = installResolvedAssetsTask(assets, new MinecraftFolder(location), option).setName('installAssets', { id: version })
    await this.submit(task)
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraft(meta: MinecraftVersion) {
    const id = meta.id

    const option = this.getInstallOptions()
    const task = installVersionTask(meta, this.getPath(), option).setName('installVersion', { id: meta.id })
    try {
      await this.submit(task)
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
    }
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraftJar(version: ResolvedVersion) {
    const option = this.getInstallOptions()

    const task = new InstallJarTask(version, this.getPath(), option).setName('installVersion.jar', { id: version.id })
    try {
      await this.submit(task)
    } catch (e) {
      this.warn(`An error ocurred during download version ${version.id}`)
      this.warn(e)
    }
  }

  @Lock(LockKey.libraries)
  async installLibraries(libraries: InstallableLibrary[], version?: string) {
    let resolved: ResolvedLibrary[]
    if ('downloads' in libraries[0]) {
      resolved = Version.resolveLibraries(libraries)
    } else {
      resolved = libraries as any
    }
    const option = this.getInstallOptions()
    const task = installResolvedLibrariesTask(resolved, this.getPath(), option).setName('installLibraries', { id: version })
    try {
      await this.submit(task)
    } catch (e) {
      this.warn('An error ocurred during install libraries:')
      this.warn(e)
    }
  }

  @Lock((v: _InstallForgeOptions) => LockKey.version(`forge-${v.mcversion}-${v.version}`))
  async installForge(options: _InstallForgeOptions) {
    const minecraft = MinecraftFolder.from(this.getPath())
    let { issues } = await diagnose(options.mcversion, minecraft)
    const missingVersion = issues.some(r => r.role === 'versionJson' || r.role === 'minecraftJar')
    if (missingVersion) {
      const versions = await this.getMinecraftVersionList()
      const meta = versions.versions.find(f => f.id === options.mcversion)!
      const option = this.getInstallOptions()
      const version = await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion'))
      issues = await diagnoseLibraries(version, minecraft)
    }

    const missingLib = issues.some(r => r.role === 'library')
    if (missingLib) {
      await this.installLibraries(issues.filter((i): i is LibraryIssue => i.role === 'library').map(i => i.library))
    }

    return await this.installForgeInternal(options)
  }

  @Lock((v: _InstallForgeOptions) => LockKey.version(`forge-${v.mcversion}-${v.version}`))
  async installForgeUnsafe(options: _InstallForgeOptions) {
    return await this.installForgeInternal(options)
  }

  private async installForgeInternal(options: _InstallForgeOptions) {
    const validJavaPaths = this.javaService.state.all.filter(v => v.valid)
    const installOptions = this.getForgeInstallOptions()

    validJavaPaths.sort((a, b) => a.majorVersion === 8 ? -1 : b.majorVersion === 8 ? 1 : -1)

    let version: string | undefined
    for (const java of validJavaPaths) {
      try {
        this.log(`Start to install forge ${options.version} on ${options.mcversion} by ${java.path}`)
        version = await this.submit(installForgeTask(options, this.getPath(), {
          ...installOptions,
          java: java.path,
          inheritsFrom: options.mcversion,
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
    return version
  }

  @Lock((v: InstallFabricOptions) => LockKey.version(`fabric-${v.minecraft}-${v.loader}`))
  async installFabric(options: InstallFabricOptions) {
    const minecraft = MinecraftFolder.from(this.getPath())
    const hasValidVersion = async () => {
      try {
        await Version.parse(minecraft, options.minecraft)
        return true
      } catch (e) {
        return false
      }
    }
    if (!await hasValidVersion()) {
      const meta = (await this.getMinecraftVersionList()).versions.find(f => f.id === options.minecraft)!
      const option = this.getInstallOptions()
      await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion', { id: options.minecraft }))
    }
    return await this.installFabricInternal(options)
  }

  @Lock((v: InstallFabricOptions) => LockKey.version(`fabric-${v.minecraft}-${v.loader}`))
  async installFabricUnsafe(options: InstallFabricOptions) {
    return await this.installFabricInternal(options)
  }

  private async installFabricInternal(options: InstallFabricOptions) {
    try {
      this.log(`Start to install fabric: yarn ${options.yarn}, loader ${options.loader}.`)
      const result = await this.submit(task('installFabric', async () => {
        const url = new URL('https://meta.fabricmc.net/v2/versions/loader/' + options.minecraft + '/' + options.loader)
        const apis = this.baseService.getApiSets().map(a => a.url).concat(url.href)
        let err: any
        while (apis.length > 0) {
          try {
            const api = new URL(apis.shift()!)
            url.host = api.host
            const resp = await request(url.toString(), { throwOnError: true })
            const artifact = await resp.body.json()
            const result = await installFabric(artifact, this.getPath(), { side: 'client' })
            return result
          } catch (e) {
            err = e
          }
        }
        throw err
      }, { id: options.minecraft }))
      this.log(`Success to install fabric: yarn ${options.yarn}, loader ${options.loader}. The new version is ${result}`)
      return result
    } catch (e) {
      this.warn(`An error ocurred during install fabric yarn-${options.yarn}, loader-${options.loader}`)
      this.warn(e)
    }
    return undefined
  }

  @Lock(v => LockKey.version(`quilt-${v.minecraftVersion}-${v.version}`))
  async installQuilt(options: InstallQuiltOptions) {
    const minecraft = MinecraftFolder.from(this.getPath())
    const hasValidVersion = async () => {
      try {
        await Version.parse(minecraft, options.minecraftVersion)
        return true
      } catch (e) {
        return false
      }
    }
    if (!await hasValidVersion()) {
      const meta = (await this.getMinecraftVersionList()).versions.find(f => f.id === options.minecraftVersion)!
      const option = this.getInstallOptions()
      await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion', { id: options.minecraftVersion }))
    }

    return await this.installQuiltInternal(options)
  }

  @Lock(v => LockKey.version(`quilt-${v.minecraftVersion}-${v.version}`))
  async installQuiltUnsafe(options: InstallQuiltOptions) {
    return await this.installQuiltInternal(options)
  }

  private async installQuiltInternal(options: InstallQuiltOptions) {
    const version = await installQuiltVersion({
      minecraft: this.getPath(),
      minecraftVersion: options.minecraftVersion,
      version: options.version,
    })
    return version
  }

  @Lock((v: InstallOptifineOptions) => LockKey.version(`optifine-${v.mcversion}-${v.type}_${v.patch}`))
  async installOptifine(options: InstallOptifineOptions) {
    const minecraft = MinecraftFolder.from(this.getPath())
    const hasValidVersion = async (version: string) => {
      try {
        await Version.parse(minecraft, version)
        return true
      } catch (e) {
        return false
      }
    }
    if (!await hasValidVersion(options.mcversion)) {
      const meta = (await this.getMinecraftVersionList()).versions.find(f => f.id === options.mcversion)!
      const option = this.getInstallOptions()
      await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion', { id: meta.id }))
    }

    if (options.forgeVersion) {
      const localForge = this.versionService.state.local.find(v => v.minecraft === options.mcversion && v.forge === options.forgeVersion)
      if (!localForge) {
        const list = await this.getForgeVersionList({ minecraftVersion: options.mcversion })
        const forgeVersion = list.find(v => v.version === options.forgeVersion)
        const forgeVersionId = forgeVersion?.version ?? options.forgeVersion
        const installedForge = await this.installForgeUnsafe({ mcversion: options.mcversion, version: forgeVersionId })
        options.inheritFrom = installedForge
      } else {
        options.inheritFrom = localForge.id
      }
    }

    return await this.installOptifineInternal(options)
  }

  @Lock((v: InstallOptifineOptions) => LockKey.version(`optifine-${v.mcversion}-${v.type}_${v.patch}`))
  async installOptifineUnsafe(options: InstallOptifineOptions) {
    return await this.installOptifineInternal(options)
  }

  private async installOptifineInternal(options: InstallOptifineOptions) {
    const minecraft = new MinecraftFolder(this.getPath())
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(`/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`)
    const downloadOptions = this.networkManager.getDownloadBaseOptions()

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
    if (this.baseService.getApiSets()[0].name === 'mcbbs') {
      urls.push(
        `https://download.mcbbs.net/optifine/${options.mcversion}/${options.type}/${options.patch}`,
        `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
      )
    } else {
      urls.push(
        `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
        `https://download.mcbbs.net/optifine/${options.mcversion}/${options.type}/${options.patch}`,
      )
    }
    const id = await this.submit(task('installOptifine', async function () {
      await this.yield(new DownloadTask({
        ...downloadOptions,
        url: urls,
        destination: path,
      }).setName('download'))
      resourceService.importResources([{ path, domain: ResourceDomain.Mods }]).catch((e) => {
        error(`Fail to import optifine as mod! ${path}`)
        error(e)
      })
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
      return id
    }, { id: optifineVersion }))

    this.log(`Succeed to install optifine ${version} on ${options.inheritFrom ?? options.mcversion}. ${id}`)

    return id
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
      this.warn(err)
    }
  }
}
