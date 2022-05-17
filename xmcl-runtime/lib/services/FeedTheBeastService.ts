import { CachedFTBModpackVersionManifest, FeedTheBeastService as IFeedTheBeastService, FeedTheBeastServiceKey, FeedTheBeastState, FTBModpackManifest, FTBModpacksResult, FTBModpackVersionManifest, FTBVersionManifestStoreSchema, GetFTBModpackVersionOptions, InstallFTBModpackVersionOptions, SearchFTBModpackOptions } from '@xmcl/runtime-api'
import { readFile, writeFile } from 'atomically'
import { LauncherApp } from '../app/LauncherApp'
import { CacheDictionary } from '../util/cache'
import { createSafeFile } from '../util/persistance'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { Inject, StatefulService } from './Service'

class PersistCache<T> extends CacheDictionary<T> {
  constructor(private cacheFile: string) {
    super(60 * 1000 * 10)
    readFile(this.cacheFile, { encoding: 'utf-8' }).then((v) => {
      this.cache = JSON.parse(v)
    }, () => {
      // ignore error
    })
  }

  set(key: string, value: T, ttl?: number) {
    super.set(key, value, ttl)
    writeFile(this.cacheFile, JSON.stringify(this.cache))
  }

  delete(key: string) {
    super.delete(key)
    writeFile(this.cacheFile, JSON.stringify(this.cache))
    return true
  }

  clear(): void {
    super.clear()
    writeFile(this.cacheFile, JSON.stringify(this.cache))
  }
}

export class FeedTheBeastService extends StatefulService<FeedTheBeastState> implements IFeedTheBeastService {
  private api = this.networkManager.request.extend({
    prefixUrl: 'https://api.modpacks.ch/public/',
    cache: new PersistCache(this.getPath('ftb-cache.json')),
    headers: {
      'User-Agent': 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36 OverwolfClient/0.195.0.18',
      Origin: 'overwolf-extension://cmogmmciplgmocnhikmphehmeecmpaggknkjlbag',
    },
  })

  private cache = createSafeFile(this.getPath('ftb.json'), FTBVersionManifestStoreSchema, this)

  private cachedVersions: CachedFTBModpackVersionManifest[] = []

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app, FeedTheBeastServiceKey, () => new FeedTheBeastState(), async () => {
      const result = await this.cache.read()
      this.cachedVersions = result.caches ?? []
    })
  }

  async getAllCachedModpackVersions(): Promise<CachedFTBModpackVersionManifest[]> {
    return this.cachedVersions
  }

  private async saveManifest(man: CachedFTBModpackVersionManifest) {
    const existedIndex = this.cachedVersions.findIndex(v => v.id === man.id)
    if (existedIndex !== -1) {
      this.cachedVersions[existedIndex] = man
    } else {
      this.cachedVersions.push(man)
    }
    await this.cache.write({ caches: this.cachedVersions })
  }

  async searchModpacks(options?: SearchFTBModpackOptions): Promise<FTBModpacksResult> {
    this.log(`Try search modpacks keyword=${options?.keyword ?? ''}`)
    const result: FTBModpacksResult = await this.api.get(`modpack/search/8?term=${options?.keyword ?? ''}`).json()
    this.log(`Got ${result.total} modpacks with keyword=${options?.keyword ?? ''}`)
    return result
  }

  async getFeaturedModpacks(): Promise<FTBModpacksResult> {
    this.log('Try get featured modpacks')

    const result: FTBModpacksResult = await this.api.get('modpack/featured/5').json()
    this.log(`Got ${result.total} featured modpacks`)
    return result
  }

  async getModpackManifest(id: number): Promise<FTBModpackManifest> {
    this.log(`Try get modpack for id=${id}`)
    const result: FTBModpackManifest = await this.api.get(`modpack/${id}`).json()
    this.log(`Got modpack for id=${id}`)
    return result
  }

  async getModpackVersionManifest({ modpack, version }: GetFTBModpackVersionOptions): Promise<FTBModpackVersionManifest> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    this.log(`Try get modpack version for modpackId=${modpackId}, versionId=${version.id}`)
    const existed = this.cachedVersions.find(v => v.id === version.id)
    if (existed && existed.updated >= version.updated) {
      return existed
    }
    const modpackManifest = typeof modpack === 'number' ? await this.getModpackManifest(modpack) : modpack
    const result: FTBModpackVersionManifest = await this.api.get(`modpack/${modpackId}/${version.id}`).json()
    if ((result as any).status === 'error') {
      throw new Error(`Fail to get manifest for ${modpackId} ${version.id}`)
    }
    this.saveManifest({
      ...result,
      projectName: modpackManifest.name,
      authors: modpackManifest.authors,
    })
    this.log(`Got modpack version for modpackId=${modpackId}, versionId=${version.id}`)
    return result
  }

  async getModpackVersionChangelog({ modpack, version }: GetFTBModpackVersionOptions): Promise<string> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    this.log(`Try get modpack changelog for modpackId=${modpackId}, versionId=${version.id}`)
    const result: { content: string } = await this.api.get(`modpack/${modpackId}/${version.id}/changelog`).json()
    this.log(`Got modpack changelog for modpackId=${modpackId}, versionId=${version.id}`)
    return result.content
  }

  async installModpackVersion(options: InstallFTBModpackVersionOptions): Promise<string> {
    const { instancePath = this.instanceService.state.path, version } = options

    const { files, targets } = version

    return ''
  }
}
