import { MinecraftFolder, ResolvedLibrary, Version } from '@xmcl/core'
import { DownloadTask, getFabricLoaderArtifact, getForgeVersionList, getLiteloaderVersionList, getLoaderArtifactList, getVersionList, getYarnArtifactList, installAssetsTask, installByProfileTask, installFabric, InstallForgeOptions, installForgeTask, installLibrariesTask, installLiteloaderTask, installOptifineTask, installResolvedAssetsTask, installResolvedLibrariesTask, installVersionTask, LiteloaderVersion, LOADER_MAVEN_URL, MinecraftVersion, Options, YARN_MAVEN_URL } from '@xmcl/installer'
import { task } from '@xmcl/task'
import { ensureFile, readJSON, writeFile } from 'fs-extra'
import { URL } from 'url'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import DiagnoseService from './DiagnoseService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton } from './Service'
import VersionService from './VersionService'
import LauncherApp from '/@main/app/LauncherApp'
import { RuntimeVersions } from '/@shared/entities/instance.schema'
import { isFabricLoaderLibrary, isForgeLibrary, isSameForgeVersion, parseOptifineVersion } from '/@shared/entities/version'
import { ForgeVersion, ForgeVersionList, OptifineVersion, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema } from '/@shared/entities/version.schema'
import { InstallServiceKey, InstallOptifineOptions, InstallService as IInstallService } from '/@shared/services/InstallService'

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
@ExportService(InstallServiceKey)
export default class InstallService extends AbstractService implements IInstallService {
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
    @Inject(VersionService) private local: VersionService,
    @Inject(DiagnoseService) diagnoseService: DiagnoseService,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)

    diagnoseService.registerMatchedFix(['missingVersionJson', 'missingVersionJar', 'corruptedVersionJson', 'corruptedVersionJar'],
      async (issues) => {
        const i = issues[0]
        const { minecraft, forge, fabricLoader } = i.arguments! as RuntimeVersions
        const metadata = this.state.version.minecraft.versions.find(v => v.id === minecraft)
        if (metadata) {
          await this.installMinecraft(metadata)
          if (forge) {
            const found = this.state.version.forge.find(f => f.mcversion === minecraft)
              ?.versions.find(v => v.version === forge)
            if (found) {
              const forge = found
              const fullVersion = await this.installForge(forge)
              if (fullVersion) {
                // await this.install.installDependencies(fullVersion);
              }
            } else {
              this.pushException({ type: 'fixVersionNoForgeVersionMetadata', minecraft, forge })
            }
          }
          if (fabricLoader) {
            await this.installFabric({ loader: fabricLoader, minecraft })
          }

          // TODO: check liteloader
        } else {
          this.pushException({ type: 'fixVersionNoVersionMetadata', minecraft })
        }
      },
      diagnoseService.diagnoseVersion.bind(diagnoseService))

    diagnoseService.registerMatchedFix(['missingVersion'],
      async (issues) => {
        if (!issues[0].arguments) return
        const { minecraft, forge, fabricLoader, optifine } = issues[0].arguments as RuntimeVersions
        let targetVersion: string | undefined
        if (minecraft && this.state.version.local.every(v => v.minecraftVersion !== minecraft)) {
          if (this.state.version.minecraft.versions.length === 0) {
            await this.refreshMinecraft()
          }
          const metadata = this.state.version.minecraft.versions.find(v => v.id === minecraft)
          if (metadata) {
            await this.installMinecraft(metadata)
          }
          targetVersion = metadata?.id
        }
        if (forge) {
          let forges = this.state.version.forge.find(v => v.mcversion === minecraft)
          if (!forges) {
            await this.refreshForge({ mcversion: minecraft })
          }
          forges = this.state.version.forge.find(v => v.mcversion === minecraft)
          const forgeVer = forges?.versions.find(v => isSameForgeVersion(v.version, forge))
          if (!forgeVer) {
            targetVersion = await this.installForge({ mcversion: minecraft, version: forge })
          } else {
            targetVersion = await this.installForge(forgeVer)
          }
        } else if (fabricLoader) {
          targetVersion = await this.installFabric({ minecraft, loader: fabricLoader })
        }
        if (optifine) {
          const { patch, type } = parseOptifineVersion(optifine)
          const id = await this.installOptifine({ mcversion: minecraft, patch, type, inhrenitFrom: targetVersion })
          targetVersion = id
        }
        if (targetVersion) {
          await this.installDependencies(targetVersion)
        }
      },
      diagnoseService.diagnoseVersion.bind(diagnoseService))

    diagnoseService.registerMatchedFix(['missingAssetsIndex', 'corruptedAssetsIndex'],
      (issues) => this.installAssetsForVersion(issues[0].arguments.version),
      diagnoseService.diagnoseVersion.bind(diagnoseService))

    diagnoseService.registerMatchedFix(['missingAssets', 'corruptedAssets'],
      (issues) => {
        const assets = [
          ...issues.filter(i => i.multi).map(i => i.arguments.values).reduce((a, b) => [...a, ...b], []),
          ...issues.filter(i => !i.multi).map(i => i.arguments),
        ]
        return this.installAssets(assets)
      },
      diagnoseService.diagnoseVersion.bind(diagnoseService))

    diagnoseService.registerMatchedFix(['missingLibraries', 'corruptedLibraries'],
      async (issues) => {
        const libs = [
          ...issues.filter(i => i.multi).map(i => i.arguments.values).reduce((a, b) => [...a, ...b], []),
          ...issues.filter(i => !i.multi).map(i => i.arguments),
        ]
        return this.installLibraries({ libraries: libs })
      },
      diagnoseService.diagnoseVersion.bind(diagnoseService))

    diagnoseService.registerMatchedFix(['badInstall'],
      async (issues) => {
        const task = installByProfileTask(issues[0].arguments.installProfile, this.getPath(), { java: this.getters.defaultJava.path })
        await this.submit(task)
      },
      diagnoseService.diagnoseVersion.bind(diagnoseService))
  }

  async initialize() {
    const [mc, forge, liteloader, fabric, optifine] = await Promise.all([
      this.minecraftVersionJson.read(),
      this.forgeVersionJson.read(),
      this.liteloaderVersionJson.read(),
      this.fabricVersionJson.read(),
      this.optifineVersionJson.read(),
    ])

    if (typeof mc === 'object') {
      this.commit('minecraftMetadata', mc)
    }
    if (typeof forge === 'object') {
      for (const value of Object.values(forge)) {
        this.commit('forgeMetadata', value)
      }
    }
    if (liteloader) {
      this.commit('liteloaderMetadata', liteloader)
    }
    if (fabric) {
      this.commit('fabricLoaderMetadata', { versions: fabric.loaders, timestamp: fabric.loaderTimestamp })
      this.commit('fabricYarnMetadata', { versions: fabric.yarns, timestamp: fabric.yarnTimestamp })
    }
    if (optifine) {
      this.commit('optifineMetadata', optifine)
    }

    this.storeManager.subscribe('minecraftMetadata', () => {
      this.minecraftVersionJson.write(this.state.version.minecraft)
    }).subscribe('forgeMetadata', () => {
      this.forgeVersionJson.write(this.state.version.forge)
    }).subscribe('liteloaderMetadata', () => {
      this.liteloaderVersionJson.write(this.state.version.liteloader)
    }).subscribeAll(['fabricLoaderMetadata', 'fabricYarnMetadata'], () => {
      this.fabricVersionJson.write(this.state.version.fabric)
    }).subscribe('optifineMetadata', () => {
      this.optifineVersionJson.write(this.state.version.optifine)
    })
  }

  protected getMinecraftJsonManifestRemote() {
    if (this.networkManager.isInGFW && this.state.base.apiSetsPreference !== 'mojang') {
      const api = this.state.base.apiSets.find(a => a.name === this.state.base.apiSetsPreference)
      if (api) {
        return `${api.url}/mc/game/version_manifest.json`
      }
    }
    return undefined
  }

  protected getForgeInstallOptions(): InstallForgeOptions {
    const options: InstallForgeOptions = {
      ...this.networkManager.getDownloadBaseOptions(),
      overwriteWhen: 'checksumNotMatch',
      java: this.getters.defaultJava.path,
    }
    if (this.networkManager.isInGFW && this.state.base.apiSetsPreference !== 'mojang') {
      const api = this.state.base.apiSets.find(a => a.name === this.state.base.apiSetsPreference)
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
      overwriteWhen: 'checksumNotMatch',
      side: 'client',
    }

    if (this.networkManager.isInGFW && this.state.base.apiSetsPreference !== 'mojang') {
      const api = this.state.base.apiSets.find(a => a.name === this.state.base.apiSetsPreference)
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

  /**
   * Request minecraft version list and cache in to store and disk.
   */
  @Singleton()
  async refreshMinecraft(force = false) {
    if (!force && this.refreshedMinecraft) {
      this.log('Skip to refresh Minecraft metadata. Use cache.')
      return
    }
    this.log('Start to refresh minecraft version metadata.')
    const oldMetadata = this.state.version.minecraft
    const remote = this.getMinecraftJsonManifestRemote()
    const newMetadata = await getVersionList({ original: oldMetadata, remote })
    if (oldMetadata !== newMetadata) {
      this.log('Found new minecraft version metadata. Update it.')
      this.commit('minecraftMetadata', newMetadata)
    } else {
      this.log('Not found new Minecraft version metadata. Use cache.')
    }
    this.refreshedMinecraft = true
  }

  /**
   * Install assets which defined in this version asset.json. If this version is not present, this will throw error！
   * @param version The local version id
   */
  @Singleton('install')
  async installAssetsForVersion(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
  }

  @Singleton('install')
  async installDependencies(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const resolvedVersion = await Version.parse(location, version)
    await this.submit(installLibrariesTask(resolvedVersion, option).setName('installLibraries'))
    await this.submit(installAssetsTask(resolvedVersion, option).setName('installAssets'))
  }

  /**
   * If you think a version is corrupted, you can try to reinstall this version
   * @param version The version to reinstall
   */
  @Singleton('install')
  async reinstall(version: string) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const local = this.state.version.local.find(v => v.id === version)
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

  /**
   * Install assets to the version
   * @param version The local version id
   */
  @Singleton('install')
  async installAssets(assets: { name: string; size: number; hash: string }[]) {
    const option = this.getInstallOptions()
    const location = this.getPath()
    const task = installResolvedAssetsTask(assets, new MinecraftFolder(location), option).setName('installAssets')
    await this.submit(task)
  }

  /**
   * Download and install a minecract version
   */
  @Singleton('install')
  async installMinecraft(meta: MinecraftVersion) {
    const id = meta.id

    const option = this.getInstallOptions()
    const task = installVersionTask(meta, this.getPath(), option).setName('installVersion')
    try {
      await this.submit(task)
      this.local.refreshVersions()
    } catch (e) {
      this.warn(`An error ocurred during download version ${id}`)
      this.warn(e)
    }
  }

  /**
   * Install provided libraries to game.
   */
  @Singleton('install')
  async installLibraries({ libraries }: { libraries: (Version.Library | ResolvedLibrary)[] }) {
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

  /**
  * Refresh forge remote versions cache from forge websites or BMCL API
  */
  @Singleton()
  async refreshForge(options: { force?: boolean; mcversion?: string } = {}) {
    let { mcversion, force } = options

    mcversion = mcversion || this.getters.instance.runtime.minecraft

    if (!force && this.refreshedForge[mcversion]) {
      this.log(`Skip to refresh forge metadata from ${mcversion}. Use cache.`)
      return
    }
    this.refreshedForge[mcversion] = true

    let minecraftVersion = mcversion
    if (!minecraftVersion) {
      const prof = this.state.instance.all[this.state.instance.path]
      if (!prof) {
        this.log('The instance refreshing is not ready. Break forge versions list update.')
        return
      }
      minecraftVersion = prof.runtime.minecraft
    }

    try {
      const currentForgeVersion = this.state.version.forge.find(f => f.mcversion === minecraftVersion)!

      let newForgeVersion = currentForgeVersion
      if (this.networkManager.isInGFW) {
        this.log(`Update forge version list (BMCL) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await this.getForgesFromBMCL(mcversion, currentForgeVersion)
      } else {
        this.log(`Update forge version list (ForgeOfficial) for Minecraft ${minecraftVersion}`)
        newForgeVersion = await getForgeVersionList({ mcversion: minecraftVersion, original: currentForgeVersion as any }) as any
      }

      if (newForgeVersion !== currentForgeVersion) {
        this.log('Found new forge versions list. Update it')
        this.commit('forgeMetadata', newForgeVersion)
      } else {
        this.log('No new forge version metadata found. Skip.')
      }
    } catch (e) {
      this.error(`Fail to fetch forge info of ${minecraftVersion}`)
      this.error(e)
    }
  }

  /**
   * Install forge by forge version metadata
   */
  @Singleton('install')
  async installForge(meta: Parameters<typeof installForgeTask>[0]) {
    const options = this.getForgeInstallOptions()

    let version: string | undefined
    try {
      this.log(`Start to install forge ${meta.version} on ${meta.mcversion}`)
      version = await this.submit(installForgeTask(meta, this.getPath(), options))
      this.local.refreshVersions()
      this.log(`Success to install forge ${meta.version} on ${meta.mcversion}`)
    } catch (err) {
      this.warn(`An error ocurred during download version ${meta.version}@${meta.mcversion}`)
      this.warn(err)
    }

    return version
  }

  /**
   * Refresh fabric version list in the store.
   * @param force shouls the version be refresh regardless if we have already refreshed fabric version.
   */
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

    const [yarnModified, yarnDate] = await getIfModified(YARN_MAVEN_URL, this.state.version.fabric.yarnTimestamp)

    if (yarnModified) {
      const versions = await getYarnArtifactList()
      this.commit('fabricYarnMetadata', { versions, timestamp: yarnDate })
      this.log(`Refreshed fabric yarn metadata at ${yarnDate}.`)
    }

    const [loaderModified, loaderDate] = await getIfModified(LOADER_MAVEN_URL, this.state.version.fabric.loaderTimestamp)

    if (loaderModified) {
      const versions = await getLoaderArtifactList()
      this.commit('fabricLoaderMetadata', { versions, timestamp: loaderDate })
      this.log(`Refreshed fabric loader metadata at ${loaderDate}.`)
    }

    this.refreshedFabric = true
  }

  /**
   * Install fabric to the minecraft
   * @param versions The fabric versions
   */
  @Singleton('install')
  async installFabric(versions: { yarn?: string; loader: string; minecraft: string }) {
    try {
      this.log(`Start to install fabric: yarn ${versions.yarn}, loader ${versions.loader}.`)
      const result = await this.submit(task('installFabric', async () => {
        const artifact = await getFabricLoaderArtifact(versions.minecraft, versions.loader)
        return installFabric(artifact, this.getPath(), { side: 'client' })
      }))
      this.local.refreshVersions()
      this.log(`Success to install fabric: yarn ${versions.yarn}, loader ${versions.loader}. The new version is ${result}`)
      return result
    } catch (e) {
      this.warn(`An error ocurred during install fabric yarn-${versions.yarn}, loader-${versions.loader}`)
      this.warn(e)
    }
    return undefined
  }

  /**
   * Refresh optifine version list from BMCL API
   */
  @Singleton()
  async refreshOptifine(force = false) {
    if (!force && this.refreshedOptifine) {
      return
    }

    this.log('Start to refresh optifine metadata')

    const headers = this.state.version.optifine.etag === '' ? undefined : {
      'If-None-Match': this.state.version.optifine.etag,
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

      this.commit('optifineMetadata', {
        etag,
        versions,
      })
      this.log('Found new optifine version metadata. Update it.')
    }

    this.refreshedOptifine = true
  }

  /**
   * Install the optifine to the minecraft
   */
  @Singleton('install')
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

    const java = this.getters.defaultJava.valid ? this.getters.defaultJava.path : undefined
    const resourceService = this.resourceService
    const error = this.error

    const id = await this.submit(task('installOptifine', async function () {
      await this.yield(new DownloadTask({
        ...downloadOptions,
        url: `https://bmclapi2.bangbang93.com/optifine/${options.mcversion}/${options.type}/${options.patch}`,
        destination: path,
      }).setName('download'))
      resourceService.importFile({
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

  /**
   * Refresh the listloader version list from its github
   */
  @Singleton()
  async refreshLiteloader(force = false) {
    if (!force && this.refreshedLiteloader) {
      return
    }

    const option = this.state.version.liteloader.timestamp === '' ? undefined : {
      original: this.state.version.liteloader,
    }
    const remoteList = await getLiteloaderVersionList(option)
    if (remoteList !== this.state.version.liteloader) {
      this.commit('liteloaderMetadata', remoteList)
    }

    this.refreshedLiteloader = true
  }

  /**
   * Install a specific liteloader version
   */
  @Singleton('install')
  async installLiteloader(meta: LiteloaderVersion) {
    try {
      await this.submit(installLiteloaderTask(meta, this.getPath()))
    } catch (err) {
      this.warn(err)
    } finally {
      this.local.refreshVersions()
    }
  }
}
