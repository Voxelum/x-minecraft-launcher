import { parse as parseForge } from '@xmcl/forge-site-parser'
import { DEFAULT_VERSION_MANIFEST_URL, FabricArtifactVersion, LabyModManifest, MinecraftVersionList, QuiltArtifactVersion, getLabyModManifest } from '@xmcl/installer'
import { FabricVersions, ForgeVersion, VersionMetadataService as IVersionMetadataService, LiteloaderVersions, MinecraftVersions, MutableState, NeoForgedVersions, OptifineVersion, Settings, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { XMLParser } from 'fast-xml-parser'
import { request } from 'undici'
import { NetworkInterface, kNetworkInterface } from '~/network'
import { assertErrorWithCache, kCacheKey } from '~/network/dispatchers/cacheDispatcher'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { GFW } from '../entities/gfw'
import { kSettings, shouldOverrideApiSet } from '../entities/settings'
import { AnyError } from '../util/error'
import { getForgeListFromBMCL } from '../util/forge'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

@ExposeServiceKey(VersionMetadataServiceKey)
export class VersionMetadataService extends AbstractService implements IVersionMetadataService {
  private latestRelease = '1.20.2'

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(GFW) private gfw: GFW,
    @Inject(kNetworkInterface) networkInterface: NetworkInterface,
    @Inject(kSettings) private settings: MutableState<Settings>,
  ) {
    super(app, async () => {
      this.getFabricVersionList()
      this.getMinecraftVersionList()
      this.getOptifineVersionList()
    })

    networkInterface.registerDispatchInterceptor((options) => {
      if (options.skipOverride) {
        return
      }
      const origin = options.origin instanceof URL ? options.origin : new URL(options.origin!)
      if (origin.host === 'meta.fabricmc.net') {
        if (shouldOverrideApiSet(this.settings, gfw.inside)) {
          const api = this.settings.apiSets.find(a => a.name === this.settings.apiSetsPreference) || this.settings.apiSets[0]
          const url = new URL(api.url + '/fabric-meta' + options.path)
          options.origin = url.origin
          options.path = url.pathname + url.search
        }
      } else if (origin.host === 'launchermeta.mojang.com') {
        if (shouldOverrideApiSet(this.settings, gfw.inside)) {
          const api = this.settings.apiSets.find(a => a.name === this.settings.apiSetsPreference) || this.settings.apiSets[0]
          options.origin = new URL(api.url).origin
        }
      } else if (origin.host === 'bmclapi2.bangbang93.com' || origin.host === 'bmclapi.bangbang93.com') {
        // bmclapi might have mirror
        if (shouldOverrideApiSet(this.settings, gfw.inside)) {
          const api = this.settings.apiSets.find(a => a.name === this.settings.apiSetsPreference) || this.settings.apiSets[0]
          options.origin = new URL(api.url).origin
        }
      }
    })
  }

  getLatestRelease() {
    return this.latestRelease
  }

  async getLatestMinecraftRelease() {
    return this.latestRelease
  }

  @Singleton()
  async getMinecraftVersionList(): Promise<MinecraftVersions> {
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
  async getNeoForgedVersionList() {
    const response = await request('https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml')
    const body = await response.body.text()
    const parser = new XMLParser()
    const forgeMetadata = parser.parse(body)
    const versions = forgeMetadata.metadata.versioning.versions
    const result: NeoForgedVersions = {
      latest: forgeMetadata.metadata.versioning.latest,
      release: forgeMetadata.metadata.versioning.release,
      versions: versions.version,
    }
    return result
  }

  @Singleton()
  async getLabyModManifest(): Promise<LabyModManifest> {
    const manifest = await getLabyModManifest()
    return manifest
  }

  @Singleton()
  async getForgeVersionList(minecraftVersion: string): Promise<ForgeVersion[]> {
    if (!minecraftVersion) {
      throw new TypeError('Empty Minecraft Version')
    }

    try {
      if (shouldOverrideApiSet(this.settings, this.gfw.inside)) {
        return await getForgeListFromBMCL(minecraftVersion)
      }
      try {
        const response = await request(`http://files.minecraftforge.net/net/minecraftforge/forge/index_${minecraftVersion}.html`, {
          maxRedirections: 2,
        })
        return parseForge(await response.body.text()).versions.map(v => {
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
          } as ForgeVersion
        })
      } catch {
        return await getForgeListFromBMCL(minecraftVersion)
      }
    } catch (e) {
      throw new AnyError('ForgeVersionListError', `Fail to fetch forge info of ${minecraftVersion}`, { cause: e })
    }
  }

  @Singleton()
  async getLiteloaderVersionList(force?: boolean): Promise<LiteloaderVersions> {
    throw new Error()
  }

  @Singleton()
  async getFabricVersionList(): Promise<FabricVersions> {
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
  async getOptifineVersionList(): Promise<OptifineVersion[]> {
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
  async getQuiltVersionList(minecraftVersion?: string): Promise<QuiltArtifactVersion[]> {
    const hasMinecraft = async () => {
      if (minecraftVersion) {
        const url = `https://meta.fabricmc.net/v2/versions/intermediary/${minecraftVersion}`
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
        throw new AnyError('QuiltVersionListError')
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
}
