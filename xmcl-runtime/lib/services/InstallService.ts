import { diagnose, diagnoseLibraries, LibraryIssue, MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core'
import { DEFAULT_FABRIC_API, DownloadTask, getFabricLoaderArtifact, getForgeVersionList, getLiteloaderVersionList, getLoaderArtifactList, getQuiltVersionsList, getVersionList, getYarnArtifactList, installAssetsTask, installByProfileTask, installFabric, InstallForgeOptions, installForgeTask, installLibrariesTask, installLiteloaderTask, installOptifineTask, InstallProfile, installQuiltVersion, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask, LiteloaderVersion, LOADER_MAVEN_URL, MinecraftVersion, Options, QuiltArtifactVersion, YARN_MAVEN_URL } from '@xmcl/installer'
import { Asset, ForgeVersion, ForgeVersionList, GetQuiltVersionListOptions, InstallableLibrary, InstallFabricOptions, InstallForgeOptions as _InstallForgeOptions, InstallOptifineOptions, InstallQuiltOptions, InstallService as IInstallService, InstallServiceKey, isFabricLoaderLibrary, isForgeLibrary, LockKey, OptifineVersion, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema, VersionQuiltSchema } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { ensureFile, readJson, readJSON, writeFile, writeJson } from 'fs-extra'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { createSafeFile } from '../util/persistance'
import { BaseService } from './BaseService'
import { JavaService } from './JavaService'
import { ResourceService } from './ResourceService'
import { AbstractService, Inject, Lock, Singleton } from './Service'
import { VersionService } from './VersionService'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export class InstallService extends AbstractService implements IInstallService {
  private refreshedMinecraft = false
  private refreshedFabric = false
  private refreshedLiteloader = false
  private refreshedOptifine = false
  private refreshedQuilt = false
  private refreshedForge: Record<string, boolean> = {}

  private minecraftVersionJson = createSafeFile(this.getAppDataPath('minecraft-versions.json'), VersionMinecraftSchema, this, [this.getPath('minecraft-versions.json')])
  private forgeVersionJson = createSafeFile(this.getAppDataPath('forge-versions.json'), VersionForgeSchema, this, [this.getPath('forge-versions.json')])
  private liteloaderVersionJson = createSafeFile(this.getAppDataPath('lite-versions.json'), VersionLiteloaderSchema, this, [this.getPath('lite-versions.json')])
  private fabricVersionJson = createSafeFile(this.getAppDataPath('fabric-versions.json'), VersionFabricSchema, this, [this.getPath('fabric-versions.json')])
  private optifineVersionJson = createSafeFile(this.getAppDataPath('optifine-versions.json'), VersionOptifineSchema, this, [this.getPath('optifine-versions.json')])
  private quiltVersionJson = createSafeFile(this.getAppDataPath('quilt-versions.json'), VersionQuiltSchema, this, [this.getPath('quilt-versions.json')])

  constructor(app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(JavaService) private javaService: JavaService,
  ) {
    super(app, InstallServiceKey, async () => {
      this.getFabricVersionList()
      this.getMinecraftVersionList()
      this.getOptifineVersionList()
    })
  }

  @Singleton()
  async getMinecraftVersionList(force?: boolean): Promise<VersionMinecraftSchema> {
    if (!force && this.refreshedMinecraft) {
      this.log('Skip to refresh Minecraft metadata. Use cache.')
      return this.minecraftVersionJson.read()
    }
    this.log('Start to refresh minecraft version metadata.')
    const oldMetadata = await this.minecraftVersionJson.read()
    const remote = this.getMinecraftJsonManifestRemote()
    const newMetadata = await getVersionList({ original: oldMetadata, remote })
    if (oldMetadata !== newMetadata) {
      this.log('Found new minecraft version metadata. Update it.')
      this.minecraftVersionJson.write(newMetadata)
    } else {
      this.log('Not found new Minecraft version metadata. Use cache.')
    }

    return newMetadata
  }

  @Singleton()
  async getForgeVersionList(options: { force?: boolean; minecraftVersion: string }): Promise<ForgeVersion[]> {
    const { minecraftVersion, force } = options

    if (!minecraftVersion) {
      throw new Error('Empty Minecraft Version')
    }

    const data = await this.forgeVersionJson.read()
    if (!force && this.refreshedForge[minecraftVersion]) {
      const found = data.find(v => v.mcversion === options.minecraftVersion)
      if (found) {
        this.log(`Skip to refresh forge metadata from ${minecraftVersion}. Use cache.`)
        return found.versions
      }
    }

    try {
      const existed = data.find(f => f.mcversion === minecraftVersion)!

      let newForgeVersion = existed
      if (this.networkManager.isInGFW) {
        this.log(`Update forge version list (BMCL) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await this.getForgesFromBMCL(minecraftVersion, existed)
        getForgeVersionList({ mcversion: minecraftVersion, original: existed as any }).then((backup) => {
          if (backup !== existed as any) {
            // respect the forge official source
            if (existed) {
              existed.timestamp = backup.timestamp
              existed.versions = backup.versions as any
              this.forgeVersionJson.write(data)
            } else {
              this.forgeVersionJson.write([...data, backup as any])
            }
          }
        }, (e) => {
          this.error(e)
        })
      } else {
        this.log(`Update forge version list (ForgeOfficial) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await getForgeVersionList({ mcversion: minecraftVersion, original: existed as any }) as any
      }

      if (newForgeVersion !== existed) {
        this.log('Found new forge versions list. Update it')
        if (existed) {
          existed.timestamp = newForgeVersion.timestamp
          existed.versions = newForgeVersion.versions
          this.forgeVersionJson.write(data)
        } else {
          this.forgeVersionJson.write([...data, newForgeVersion])
        }
        this.refreshedForge[minecraftVersion] = true
      } else {
        this.log('No new forge version metadata found. Skip.')
      }

      return newForgeVersion.versions
    } catch (e) {
      this.error(`Fail to fetch forge info of ${minecraftVersion}`)
      this.error(e)
      // TODO: format this error
      throw e
    }
  }

  @Singleton()
  async getLiteloaderVersionList(force?: boolean): Promise<VersionLiteloaderSchema> {
    if (!force && this.refreshedLiteloader) {
      return this.liteloaderVersionJson.read()
    }

    const oldData = await this.liteloaderVersionJson.read()
    const option = oldData.timestamp === ''
      ? undefined
      : {
        original: oldData,
      }
    const remoteList = await getLiteloaderVersionList(option)
    if (remoteList !== oldData) {
      this.liteloaderVersionJson.write(remoteList)
    }

    this.refreshedLiteloader = true
    return remoteList
  }

  @Singleton()
  async getFabricVersionList(force?: boolean): Promise<VersionFabricSchema> {
    if (!force && this.refreshedFabric) {
      this.log('Skip to refresh fabric metadata. Use cache.')
      return this.fabricVersionJson.read()
    }

    this.log('Start to refresh fabric metadata')

    const getIfModified = async (url: string, timestamp: string) => {
      const { statusCode, headers } = await this.networkManager.request.head(url, { headers: { 'if-modified-since': timestamp } })
      return [statusCode === 200, headers['last-modified'] ?? timestamp] as const
    }

    const result = await this.fabricVersionJson.read()
    const [yarnModified, yarnDate] = await getIfModified(YARN_MAVEN_URL, result.yarnTimestamp)

    if (yarnModified) {
      const versions = await getYarnArtifactList()
      result.yarns = versions
      result.yarnTimestamp = yarnDate
      this.log(`Refreshed fabric yarn metadata at ${yarnDate}.`)
    }

    const [loaderModified, loaderDate] = await getIfModified(LOADER_MAVEN_URL, result.loaderTimestamp)

    if (loaderModified) {
      const versions = await getLoaderArtifactList()
      result.loaders = versions
      result.loaderTimestamp = yarnDate
      // this.state.fabricLoaderMetadata({ versions, timestamp: loaderDate })
      this.log(`Refreshed fabric loader metadata at ${loaderDate}.`)
    }

    if (yarnModified || loaderModified) {
      this.fabricVersionJson.write(result)
    }

    this.refreshedFabric = true
    return result
  }

  @Singleton()
  async getOptifineVersionList(force?: boolean): Promise<OptifineVersion[]> {
    if (!force && this.refreshedOptifine) {
      return (await this.optifineVersionJson.read()).versions
    }

    this.log('Start to refresh optifine metadata')

    const oldData = await this.optifineVersionJson.read()
    const headers = oldData.etag === ''
      ? {}
      : {
        'If-None-Match': oldData.etag,
      }

    const response = await this.networkManager.request.get('https://bmclapi2.bangbang93.com/optifine/versionList', {
      headers,
    })

    if (response.statusCode === 304) {
      this.log('Not found new optifine version metadata. Use cache.')

      return oldData.versions
    } else if (response.statusCode >= 200 && response.statusCode < 300) {
      const etag = response.headers.etag as string
      const versions: OptifineVersion[] = JSON.parse(response.body)

      this.optifineVersionJson.write({
        etag,
        versions,
      })
      this.log('Found new optifine version metadata. Update it.')

      this.refreshedOptifine = true
      return versions
    }
    // TODO: format this error
    throw oldData.versions
  }

  @Singleton()
  async getQuiltVersionList(options?: GetQuiltVersionListOptions): Promise<QuiltArtifactVersion[]> {
    const hasMinecraft = async () => {
      if (options?.minecraftVersion) {
        let baseUrl = DEFAULT_FABRIC_API
        if (this.baseService.shouldOverrideApiSet()) {
          const prefer = this.baseService.getApiSets()[0]
          baseUrl = prefer.name === 'bmcl' ? 'https://bmclapi2.bangbang93.com/fabric-meta/v2' : 'https://download.mcbbs.net/fabric-meta/v2'
        }
        const url = `${baseUrl}/versions/intermediary/${options?.minecraftVersion}`
        const request = await this.networkManager.request.get(url, { throwHttpErrors: false })
        if (request.statusCode === 200) {
          if (JSON.parse(request.body).length > 0) {
            return true
          }
        }
        return false
      }
      return true
    }
    if (!options?.force && this.refreshedQuilt) {
      this.log('Skip to request quilt version list. Use file cache.')
      const versions = (await this.quiltVersionJson.read()).versions
      if (options?.minecraftVersion) {
        if (await hasMinecraft().catch(() => false)) {
          return versions
        }
        return []
      }
      return versions
    }

    this.log('Start to get quilt metadata')
    const fileCache = await this.quiltVersionJson.read()
    const originalTimestamp = fileCache.timestamp
    const cache = {
      timestamp: fileCache.timestamp,
      value: fileCache.versions,
    }
    await getQuiltVersionsList({
      cache: cache,
    })
    this.refreshedQuilt = true
    if (originalTimestamp !== cache.timestamp) {
      this.log('Found new quilt metadata')
      await this.quiltVersionJson.write({
        timestamp: cache.timestamp,
        versions: cache.value,
      })
    } else {
      this.log('Use existed quilt metadata')
    }

    if (await hasMinecraft()) {
      return cache.value
    }
    return []
  }

  protected getMinecraftJsonManifestRemote() {
    if (this.baseService.shouldOverrideApiSet()) {
      const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference)
      if (api) {
        return `${api.url}/mc/game/version_manifest.json`
      }
    }
    return undefined
  }

  protected getForgeInstallOptions(): InstallForgeOptions {
    const options: InstallForgeOptions = {
      ...this.networkManager.getDownloadBaseOptions(),
      java: this.javaService.getPreferredJava()?.path,
    }
    if (this.baseService.shouldOverrideApiSet()) {
      const allSets = this.baseService.getApiSets()
      options.mavenHost = allSets.map(api => `${api.url}/maven`)
    }
    return options
  }

  protected getInstallOptions(): Options {
    const option: Options = {
      assetsDownloadConcurrency: 16,
      ...this.networkManager.getDownloadBaseOptions(),
      side: 'client',
    }

    if (this.baseService.shouldOverrideApiSet()) {
      const allSets = this.baseService.getApiSets()
      option.assetsHost = allSets.map(api => `${api.url}/assets`)
      option.mavenHost = allSets.map(api => `${api.url}/maven`)
      option.assetsIndexUrl = (ver) => allSets.map(api => {
        const url = new URL(ver.assetIndex.url)
        const host = new URL(api.url).host
        url.host = host
        url.hostname = host
        return url.toString()
      })

      option.json = (ver) => allSets.map(api => {
        const url = new URL(ver.url)
        const host = new URL(api.url).host
        url.host = host
        url.hostname = host
        return url.toString()
      })

      option.client = (ver) => allSets.map(api => {
        const url = new URL(ver.downloads.client.url)
        const host = new URL(api.url).host
        url.host = host
        url.hostname = host
        return url.toString()
      })
    }
    return option
  }

  private async getForgesFromBMCL(mcVersion: string, currentForgeVersion: ForgeVersionList) {
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

    const { body, statusCode, headers } = await this.networkManager.request({
      method: 'GET',
      url: `https://bmclapi2.bangbang93.com/forge/minecraft/${mcVersion}`,
      headers: currentForgeVersion && currentForgeVersion.timestamp
        ? {
          'If-Modified-Since': currentForgeVersion.timestamp,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
        }
        : {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
        },
      https: {
        rejectUnauthorized: false,
      },
    })
    function convert(v: BMCLForge): ForgeVersion {
      const installer = v.files.find(f => f.category === 'installer')!
      const universal = v.files.find(f => f.category === 'universal')!
      return {
        mcversion: v.mcversion,
        version: v.version,
        type: 'common',
        date: v.modified,
      } as any
    }
    if (statusCode === 304) {
      return currentForgeVersion
    }
    const forges: BMCLForge[] = JSON.parse(body)
    const result: ForgeVersionList = {
      mcversion: mcVersion,
      timestamp: headers['if-modified-since'] ?? forges[0]?.modified,
      versions: forges.map(convert),
    }
    return result
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets])
  async installAssetsForVersion(version: string) {
    const option = this.getInstallOptions()
    const location = MinecraftFolder.from(this.getPath())
    try {
      // this special logic is handling the asset index outdate issue.
      let resolvedVersion = await Version.parse(location, version)
      const list = await this.getMinecraftVersionList(true)
      const versionMeta = list.versions.find(v => v.id === resolvedVersion.minecraftVersion)
      let sourceMinecraftVersion = await Version.parse(location, resolvedVersion.minecraftVersion)
      if (versionMeta) {
        if (new Date(versionMeta.releaseTime) > new Date(sourceMinecraftVersion.releaseTime)) {
          // need update source version
          await this.installMinecraft(versionMeta)
          sourceMinecraftVersion = await Version.parse(location, resolvedVersion.minecraftVersion)
        }
        if (resolvedVersion.inheritances.length === 1 && resolvedVersion.inheritances[resolvedVersion.inheritances.length - 1] !== resolvedVersion.minecraftVersion) {
          // special packed version like PCL
          const jsonPath = location.getVersionJson(version)
          const rawContent = await readJson(jsonPath)
          rawContent.assetIndex = sourceMinecraftVersion.assetIndex
          await writeJson(jsonPath, rawContent)
          resolvedVersion = await Version.parse(location, version)
        }
      }
      this.warn(`Install assets for ${version}:`)
      await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
    } catch (e) {
      this.warn(`An error ocurred during assets for ${version}:`)
      this.warn(e)
    }
  }

  @Lock((v) => [LockKey.version(v), LockKey.assets, LockKey.libraries])
  async installDependencies(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries'))
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
  }

  @Lock(v => [LockKey.version(v)])
  async reinstall(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const local = await this.versionService.resolveLocalVersion(version)
    if (!local) {
      throw new Error(`Cannot reinstall ${version} as it's not found!`)
    }
    await this.submit(installVersionTask({ id: local.minecraftVersion, url: '' }, location).setName('installVersion'))
    const forgeLib = local.libraries.find(isForgeLibrary)
    if (forgeLib) {
      await this.submit(installForgeTask({ version: forgeLib.version, mcversion: local.minecraftVersion }, location).setName('installForge'))
    }
    const fabLib = local.libraries.find(isFabricLoaderLibrary)
    if (fabLib) {
      await this.installFabric({ minecraft: local.minecraftVersion, loader: fabLib.version })
    }
    await this.submit(installLibrariesTask(local, option).setName('installLibraries'))
    await this.submit(installAssetsTask(local, option).setName('installAssets'))
  }

  @Lock(LockKey.assets)
  async installAssets(assets: Asset[]) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const task = installResolvedAssetsTask(assets, new MinecraftFolder(location), option).setName('installAssets')
    await this.submit(task)
  }

  @Lock((v: MinecraftVersion) => LockKey.version(v.id))
  async installMinecraft(meta: MinecraftVersion) {
    const id = meta.id

    const option = this.getInstallOptions()
    const task = installVersionTask(meta, this.getPath(), option).setName('installVersion')
    try {
      await this.submit(task)
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
    }
  }

  @Lock(LockKey.libraries)
  async installLibraries(libraries: InstallableLibrary[]) {
    let resolved: ResolvedLibrary[]
    if ('downloads' in libraries[0]) {
      resolved = Version.resolveLibraries(libraries)
    } else {
      resolved = libraries as any
    }
    const option = this.getInstallOptions()
    const task = installResolvedLibrariesTask(resolved, this.getPath(), option).setName('installLibraries')
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
    const installOptions = this.getForgeInstallOptions()

    let version: string | undefined
    try {
      this.log(`Start to install forge ${options.version} on ${options.mcversion}`)
      version = await this.submit(installForgeTask(options, this.getPath(), installOptions))
      this.log(`Success to install forge ${options.version} on ${options.mcversion}`)
    } catch (err) {
      this.warn(`An error ocurred during download version ${options.version}@${options.mcversion}`)
      this.warn(err)
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
      await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion'))
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
        const artifact = await getFabricLoaderArtifact(options.minecraft, options.loader)
        return installFabric(artifact, this.getPath(), { side: 'client' })
      }))
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
      await this.submit(installVersionTask(meta, minecraft, option).setName('installVersion'))
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
    const minecraft = new MinecraftFolder(this.getPath())
    const optifineVersion = `${options.type}_${options.patch}`
    const version = `${options.mcversion}_${optifineVersion}`
    const path = new MinecraftFolder(this.getPath()).getLibraryByPath(`/optifine/OptiFine/${version}/OptiFine-${version}-universal.jar`)
    const downloadOptions = this.networkManager.getDownloadBaseOptions()

    this.log(`Install optifine ${version} on ${options.inhrenitFrom ?? options.mcversion}`)

    let installFromForge = false
    if (options.inhrenitFrom === options.mcversion) {
      options.inhrenitFrom = undefined
    }
    if (options.inhrenitFrom) {
      const from = await Version.parse(minecraft, options.inhrenitFrom)
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

    const id = await this.submit(task('installOptifine', async function () {
      await this.yield(new DownloadTask({
        ...downloadOptions,
        url: `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
        destination: path,
      }).setName('download'))
      resourceService.importResource({
        path,
        type: 'mods',
        background: true,
      }).catch((e) => {
        error(`Fail to import optifine as mod! ${path}`)
        error(e)
      })
      let id: string = await this.concat(installOptifineTask(path, minecraft, { java }))

      if (options.inhrenitFrom) {
        const parentJson: Version = await readJSON(minecraft.getVersionJson(options.inhrenitFrom))
        const json: Version = await readJSON(minecraft.getVersionJson(id))
        json.inheritsFrom = options.inhrenitFrom
        json.id = `${options.inhrenitFrom}-Optifine-${version}`
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
    }))

    this.log(`Succeed to install optifine ${version} on ${options.inhrenitFrom ?? options.mcversion}. ${id}`)

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

  @Singleton()
  async installByProfile(profile: InstallProfile) {
    try {
      await this.submit(installByProfileTask(profile, this.getPath(), {
        ...this.getForgeInstallOptions(),
      }))
    } catch (err) {
      this.warn(err)
    }
  }
}
