import { MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core'
import { DownloadTask, getFabricLoaderArtifact, getForgeVersionList, getLiteloaderVersionList, getLoaderArtifactList, getVersionList, getYarnArtifactList, installAssetsTask, installByProfileTask, installFabric, InstallForgeOptions, installForgeTask, installLibrariesTask, installLiteloaderTask, installOptifineTask, InstallProfile, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask, LiteloaderVersion, LOADER_MAVEN_URL, MinecraftVersion, Options, YARN_MAVEN_URL } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { ensureFile, readJSON, writeFile } from 'fs-extra'
import { URL } from 'url'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import BaseService from './BaseService'
import JavaService from './JavaService'
import ResourceService from './ResourceService'
import { ExportService, Inject, Lock, Singleton, StatefulService } from './Service'
import VersionService from './VersionService'
import LauncherApp from '../app/LauncherApp'
import { isFabricLoaderLibrary, isForgeLibrary, ForgeVersion, ForgeVersionList, OptifineVersion, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema, Asset, InstallableLibrary, InstallFabricOptions, InstallForgeOptions as _InstallForgeOptions, InstallOptifineOptions, InstallService as IInstallService, InstallServiceKey, InstallState, RefreshForgeOptions, assetsLock, librariesLock, read, versionLockOf, write } from '@xmcl/runtime-api'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
@ExportService(InstallServiceKey)
export default class InstallService extends StatefulService<InstallState> implements IInstallService {
  private refreshedMinecraft = false
  private refreshedFabric = false
  private refreshedLiteloader = false
  private refreshedOptifine = false
  private refreshedForge: Record<string, boolean> = {}

  private minecraftVersionJson = new MappedFile<VersionMinecraftSchema>(this.getPath('minecraft-versions.json'), new BufferJsonSerializer(VersionMinecraftSchema))
  private forgeVersionJson = new MappedFile<VersionForgeSchema>(this.getPath('forge-versions.json'), new BufferJsonSerializer(VersionForgeSchema))
  private liteloaderVersionJson = new MappedFile<VersionLiteloaderSchema>(this.getPath('lite-versions.json'), new BufferJsonSerializer(VersionLiteloaderSchema))
  private fabricVersionJson = new MappedFile<VersionFabricSchema>(this.getPath('fabric-versions.json'), new BufferJsonSerializer(VersionFabricSchema))
  private optifineVersionJson = new MappedFile<VersionOptifineSchema>(this.getPath('optifine-versions.json'), new BufferJsonSerializer(VersionOptifineSchema))

  constructor(app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(JavaService) private javaService: JavaService,
  ) {
    super(app, async () => {
      const [mc, forge, liteloader, fabric, optifine] = await Promise.all([
        this.minecraftVersionJson.read(),
        this.forgeVersionJson.read(),
        this.liteloaderVersionJson.read(),
        this.fabricVersionJson.read(),
        this.optifineVersionJson.read(),
      ])

      if (typeof mc === 'object') {
        this.state.minecraftMetadata(mc)
      }
      if (typeof forge === 'object') {
        for (const value of Object.values(forge)) {
          this.state.forgeMetadata(value)
        }
      }
      if (liteloader) {
        this.state.liteloaderMetadata(liteloader)
      }
      if (fabric) {
        this.state.fabricLoaderMetadata({ versions: fabric.loaders, timestamp: fabric.loaderTimestamp })
        this.state.fabricYarnMetadata({ versions: fabric.yarns, timestamp: fabric.yarnTimestamp })
      }
      if (optifine) {
        this.state.optifineMetadata(optifine)
      }

      this.storeManager.subscribe('minecraftMetadata', () => {
        this.minecraftVersionJson.write(this.state.minecraft)
      }).subscribe('forgeMetadata', () => {
        this.forgeVersionJson.write(this.state.forge)
      }).subscribe('liteloaderMetadata', () => {
        this.liteloaderVersionJson.write(this.state.liteloader)
      }).subscribeAll(['fabricLoaderMetadata', 'fabricYarnMetadata'], () => {
        this.fabricVersionJson.write(this.state.fabric)
      }).subscribe('optifineMetadata', () => {
        this.optifineVersionJson.write(this.state.optifine)
      })
    })
  }

  createState() {
    return new InstallState()
  }

  protected getMinecraftJsonManifestRemote() {
    if (this.networkManager.isInGFW && this.baseService.state.apiSetsPreference !== 'mojang') {
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
    if (this.networkManager.isInGFW && this.baseService.state.apiSetsPreference !== 'mojang') {
      const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference)
      if (api) {
        options.mavenHost = [`${api.url}/maven`]
      }
    }
    return options
  }

  protected getInstallOptions(): Options {
    const option: Options = {
      assetsDownloadConcurrency: 16,
      ...this.networkManager.getDownloadBaseOptions(),
      side: 'client',
    }

    if (this.networkManager.isInGFW && this.baseService.state.apiSetsPreference !== 'mojang') {
      const api = this.baseService.state.apiSets.find(a => a.name === this.baseService.state.apiSetsPreference)
      if (api) {
        option.assetsHost = `${api.url}/assets`
        option.mavenHost = `${api.url}/maven`
        option.assetsIndexUrl = (u) => {
          const url = new URL(u.assetIndex.url)
          const host = new URL(api.url).host
          url.host = host
          url.hostname = host
          return url.toString()
        }
        option.json = (u) => {
          const url = new URL(u.url)
          const host = new URL(api.url).host
          url.host = host
          url.hostname = host
          return url.toString()
        }
        option.client = (u) => {
          const url = new URL(u.downloads.client.url)
          const host = new URL(api.url).host
          url.host = host
          url.hostname = host
          return url.toString()
        }
      }
    }
    return option
  }

  private async getForgesFromBMCL(mcversion: string, currentForgeVersion: ForgeVersionList) {
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
      url: `https://bmclapi2.bangbang93.com/forge/minecraft/${mcversion}`,
      headers: currentForgeVersion && currentForgeVersion.timestamp
        ? {
          'If-Modified-Since': currentForgeVersion.timestamp,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
        }
        : {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36 Edg/83.0.478.45',
        },
      rejectUnauthorized: false,
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
      mcversion,
      timestamp: headers['if-modified-since'] ?? forges[0]?.modified,
      versions: forges.map(convert),
    }
    return result
  }

  @Singleton()
  async refreshMinecraft(force = false) {
    if (!force && this.refreshedMinecraft) {
      this.log('Skip to refresh Minecraft metadata. Use cache.')
      return
    }
    this.log('Start to refresh minecraft version metadata.')
    const oldMetadata = this.state.minecraft
    const remote = this.getMinecraftJsonManifestRemote()
    const newMetadata = await getVersionList({ original: oldMetadata, remote })
    if (oldMetadata !== newMetadata) {
      this.log('Found new minecraft version metadata. Update it.')
      this.state.minecraftMetadata(newMetadata)
    } else {
      this.log('Not found new Minecraft version metadata. Use cache.')
    }
    this.refreshedMinecraft = true
  }

  @Lock((v) => [read(versionLockOf(v)), write(assetsLock)])
  async installAssetsForVersion(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
  }

  @Lock((v) => [read(versionLockOf(v)), write(assetsLock), write(librariesLock)])
  async installDependencies(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries'))
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
  }

  @Lock(v => [read(versionLockOf(v))])
  async reinstall(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const local = this.versionService.state.local.find(v => v.id === version)
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

  @Lock(write(assetsLock))
  async installAssets(assets: Asset[]) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const task = installResolvedAssetsTask(assets, new MinecraftFolder(location), option).setName('installAssets')
    await this.submit(task)
  }

  @Lock((v: MinecraftVersion) => write(versionLockOf(v.id)))
  async installMinecraft(meta: MinecraftVersion) {
    const id = meta.id

    const option = this.getInstallOptions()
    const task = installVersionTask(meta, this.getPath(), option).setName('installVersion')
    try {
      await this.submit(task)
      this.versionService.refreshVersions()
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
    }
  }

  @Lock(write(librariesLock))
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

  @Singleton()
  async refreshForge(options: RefreshForgeOptions) {
    const { mcversion: minecraftVersion, force } = options

    if (!force && this.refreshedForge[minecraftVersion]) {
      this.log(`Skip to refresh forge metadata from ${minecraftVersion}. Use cache.`)
      return
    }
    this.refreshedForge[minecraftVersion] = true

    try {
      const currentForgeVersion = this.state.forge.find(f => f.mcversion === minecraftVersion)!

      let newForgeVersion = currentForgeVersion
      if (this.networkManager.isInGFW) {
        this.log(`Update forge version list (BMCL) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await this.getForgesFromBMCL(minecraftVersion, currentForgeVersion)
        getForgeVersionList({ mcversion: minecraftVersion, original: currentForgeVersion as any }).then((backup) => {
          if (backup !== currentForgeVersion as any) {
            // respect the forge official source
            this.state.forgeMetadata(backup as any)
          }
        }, (e) => {
          this.error(e)
        })
      } else {
        this.log(`Update forge version list (ForgeOfficial) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await getForgeVersionList({ mcversion: minecraftVersion, original: currentForgeVersion as any }) as any
      }

      if (newForgeVersion !== currentForgeVersion) {
        this.log('Found new forge versions list. Update it')
        this.state.forgeMetadata(newForgeVersion)
      } else {
        this.log('No new forge version metadata found. Skip.')
      }
    } catch (e) {
      this.error(`Fail to fetch forge info of ${minecraftVersion}`)
      this.error(e)
    }
  }

  @Lock((v: _InstallForgeOptions) => write(versionLockOf(`forge-${v.mcversion}-${v.version}`)))
  async installForge(options: _InstallForgeOptions) {
    const installOptions = this.getForgeInstallOptions()

    let version: string | undefined
    try {
      this.log(`Start to install forge ${options.version} on ${options.mcversion}`)
      version = await this.submit(installForgeTask(options, this.getPath(), installOptions))
      this.versionService.refreshVersions()
      this.log(`Success to install forge ${options.version} on ${options.mcversion}`)
    } catch (err) {
      this.warn(`An error ocurred during download version ${options.version}@${options.mcversion}`)
      this.warn(err)
    }

    return version
  }

  @Singleton()
  async refreshFabric(force = false) {
    if (!force && this.refreshedFabric) {
      this.log('Skip to refresh fabric metadata. Use cache.')
      return
    }

    this.log('Start to refresh fabric metadata')

    const getIfModified = async (url: string, timestamp: string) => {
      const { statusCode, headers } = await this.networkManager.request.head(url, { headers: { 'if-modified-since': timestamp } })
      return [statusCode === 200, headers['last-modified'] ?? timestamp] as const
    }

    const [yarnModified, yarnDate] = await getIfModified(YARN_MAVEN_URL, this.state.fabric.yarnTimestamp)

    if (yarnModified) {
      const versions = await getYarnArtifactList()
      this.state.fabricYarnMetadata({ versions, timestamp: yarnDate })
      this.log(`Refreshed fabric yarn metadata at ${yarnDate}.`)
    }

    const [loaderModified, loaderDate] = await getIfModified(LOADER_MAVEN_URL, this.state.fabric.loaderTimestamp)

    if (loaderModified) {
      const versions = await getLoaderArtifactList()
      this.state.fabricLoaderMetadata({ versions, timestamp: loaderDate })
      this.log(`Refreshed fabric loader metadata at ${loaderDate}.`)
    }

    this.refreshedFabric = true
  }

  @Lock((v: InstallFabricOptions) => write(versionLockOf(`fabric-${v.minecraft}-${v.loader}`)))
  async installFabric(options: InstallFabricOptions) {
    try {
      this.log(`Start to install fabric: yarn ${options.yarn}, loader ${options.loader}.`)
      const result = await this.submit(task('installFabric', async () => {
        const artifact = await getFabricLoaderArtifact(options.minecraft, options.loader)
        return installFabric(artifact, this.getPath(), { side: 'client' })
      }))
      this.versionService.refreshVersions()
      this.log(`Success to install fabric: yarn ${options.yarn}, loader ${options.loader}. The new version is ${result}`)
      return result
    } catch (e) {
      this.warn(`An error ocurred during install fabric yarn-${options.yarn}, loader-${options.loader}`)
      this.warn(e)
    }
    return undefined
  }

  @Singleton()
  async refreshOptifine(force = false) {
    if (!force && this.refreshedOptifine) {
      return
    }

    this.log('Start to refresh optifine metadata')

    const headers = this.state.optifine.etag === ''
      ? undefined
      : {
        'If-None-Match': this.state.optifine.etag,
      }

    const response = await this.networkManager.request.get('https://bmclapi2.bangbang93.com/optifine/versionList', {
      headers,
      rejectUnauthorized: false,
    })

    if (response.statusCode === 304) {
      this.log('Not found new optifine version metadata. Use cache.')
    } else if (response.statusCode >= 200 && response.statusCode < 300) {
      const etag = response.headers.etag as string
      const versions: OptifineVersion[] = JSON.parse(response.body)

      this.state.optifineMetadata({
        etag,
        versions,
      })
      this.log('Found new optifine version metadata. Update it.')
    }

    this.refreshedOptifine = true
  }

  // @Lock(v => )
  @Lock((v: InstallOptifineOptions) => write(versionLockOf(`optifine-${v.mcversion}-${v.type}_${v.patch}`)))
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

    this.versionService.refreshVersions()
    this.log(`Succeed to install optifine ${version} on ${options.inhrenitFrom ?? options.mcversion}. ${id}`)

    return id
  }

  @Singleton()
  async refreshLiteloader(force = false) {
    if (!force && this.refreshedLiteloader) {
      return
    }

    const option = this.state.liteloader.timestamp === ''
      ? undefined
      : {
        original: this.state.liteloader,
      }
    const remoteList = await getLiteloaderVersionList(option)
    if (remoteList !== this.state.liteloader) {
      this.state.liteloaderMetadata(remoteList)
    }

    this.refreshedLiteloader = true
  }

  @Singleton()
  async installLiteloader(meta: LiteloaderVersion) {
    try {
      await this.submit(installLiteloaderTask(meta, this.getPath()))
    } catch (err) {
      this.warn(err)
    } finally {
      this.versionService.refreshVersions()
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
    } finally {
      this.versionService.refreshVersions()
    }
  }
}
