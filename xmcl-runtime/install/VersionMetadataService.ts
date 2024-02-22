import { parse as parseForge } from '@xmcl/forge-site-parser'
import { DEFAULT_VERSION_MANIFEST_URL, FabricArtifactVersion, LabyModManifest, MinecraftVersionList, QuiltArtifactVersion } from '@xmcl/installer'
import { FabricVersions, ForgeVersion, HTTPException, VersionMetadataService as IVersionMetadataService, LiteloaderVersions, MinecraftVersions, MutableState, NeoForgedVersions, OptifineVersion, Settings, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { XMLParser } from 'fast-xml-parser'
import { request } from 'undici'
import { Inject, LauncherAppKey } from '~/app'
import { GFW } from '~/gfw'
import { NetworkInterface, kNetworkInterface } from '~/network'
import { AbstractService, ExposeServiceKey, Singleton } from '~/service'
import { kSettings, shouldOverrideApiSet } from '~/settings'
import { LauncherApp } from '../app/LauncherApp'
import { AnyError } from '../util/error'
import { BMCLForge, getForgeListFromBMCLList } from './getForgeListFromBMCL'
import { getJson } from './getJsonWithCache'

@ExposeServiceKey(VersionMetadataServiceKey)
export class VersionMetadataService extends AbstractService implements IVersionMetadataService {
  private latest = {
    release: '1.20.4',
    snapshot: '21w37a',
  }

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
    return this.latest.release
  }

  getLatestSnapshot() {
    return this.latest.snapshot
  }

  async getLatestMinecraftRelease() {
    return this.latest.release
  }

  @Singleton()
  async getMinecraftVersionList(): Promise<MinecraftVersions> {
    const metadata = await getJson<MinecraftVersionList>(DEFAULT_VERSION_MANIFEST_URL, 'MinecraftVersionListError')
    this.latest.release = metadata.latest.release
    this.latest.snapshot = metadata.latest.snapshot
    return metadata
  }

  @Singleton()
  async getNeoForgedVersionList(version: string) {
    const allowed = ['1.20.1', '1.20.2'/* 20.2.x */, '1.20.3'/* 20.3.x */, '1.20.4'/* 20.4.x */]
    if (!allowed.includes(version)) { return { latest: '', release: '', versions: [] } }
    const url = version === '1.20.1'
      ? 'https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml'
      : 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml'
    const response = await request(url)

    if (response.statusCode !== 200) {
      throw new HTTPException({
        type: 'httpException',
        code: '',
        method: 'GET',
        url,
        statusCode: response.statusCode,
        body: await response.body.text().catch(() => ''),
      })
    }

    const body = await response.body.text()
    const parser = new XMLParser()
    const forgeMetadata = parser.parse(body)
    const versions = forgeMetadata.metadata.versioning.versions
    const result: NeoForgedVersions = {
      latest: forgeMetadata.metadata.versioning.latest,
      release: forgeMetadata.metadata.versioning.release,
      versions: versions.version,
    }
    if (version === '1.20.2') {
      result.versions = result.versions.filter(v => v.startsWith('20.2'))
    } else if (version === '1.20.3') {
      result.versions = result.versions.filter(v => v.startsWith('20.3'))
    } else if (version === '1.20.4') {
      result.versions = result.versions.filter(v => v.startsWith('20.4'))
    }
    return result
  }

  @Singleton()
  async getLabyModManifest(): Promise<LabyModManifest> {
    const manifest = await getJson<LabyModManifest>('https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/production/latest.json', 'LabyModManifestError')
    return manifest
  }

  @Singleton()
  async getForgeVersionList(minecraftVersion: string): Promise<ForgeVersion[]> {
    if (!minecraftVersion) {
      throw new TypeError('Empty Minecraft Version')
    }

    try {
      if (shouldOverrideApiSet(this.settings, this.gfw.inside)) {
        const forges = await getJson<BMCLForge[]>(`https://bmclapi2.bangbang93.com/forge/minecraft/${minecraftVersion}`, 'ForgeVersionListError')
        return getForgeListFromBMCLList(forges)
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
        const forges = await getJson<BMCLForge[]>(`https://bmclapi2.bangbang93.com/forge/minecraft/${minecraftVersion}`, 'ForgeVersionListError')
        return getForgeListFromBMCLList(forges)
      }
    } catch (e) {
      if (e instanceof AnyError) {
        throw e
      }
      throw new AnyError('ForgeVersionListError', `Fail to fetch forge info of ${minecraftVersion}`, { cause: e })
    }
  }

  @Singleton()
  async getLiteloaderVersionList(force?: boolean): Promise<LiteloaderVersions> {
    throw new Error()
  }

  @Singleton()
  async getFabricVersionList(): Promise<FabricVersions> {
    const yarns = await getJson<FabricArtifactVersion[]>('https://meta.fabricmc.net/v2/versions/yarn', 'FabricYarnListError')
    const loaders = await getJson<FabricArtifactVersion[]>('https://meta.fabricmc.net/v2/versions/loader', 'FabricLoaderListError')
    return {
      loaders,
      yarns,
    }
  }

  @Singleton()
  async getOptifineVersionList(): Promise<OptifineVersion[]> {
    const versions = await getJson<OptifineVersion[]>('https://bmclapi2.bangbang93.com/optifine/versionList', 'OptifineVersionListError')
    return versions
  }

  @Singleton()
  async getQuiltVersionList(minecraftVersion?: string): Promise<QuiltArtifactVersion[]> {
    const versions = await getJson<QuiltArtifactVersion[]>('https://meta.quiltmc.org/v3/versions/loader', 'QuiltVersionListError')

    if (minecraftVersion) {
      const lists = await getJson<unknown[]>(`https://meta.fabricmc.net/v2/versions/intermediary/${minecraftVersion}`, 'FabricIntermediaryListError').catch(() => [])
      return lists.length > 0 ? versions : []
    }

    return versions
  }
}
