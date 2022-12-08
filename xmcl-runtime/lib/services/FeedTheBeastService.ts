import { CachedFTBModpackVersionManifest, FeedTheBeastService as IFeedTheBeastService, FeedTheBeastServiceKey, FeedTheBeastState, FTBModpackManifest, FTBModpacksResult, FTBModpackVersionManifest, GetFTBModpackVersionOptions, SearchFTBModpackOptions } from '@xmcl/runtime-api'
import { ClassicLevel } from 'classic-level'
import { readJSON } from 'fs-extra'
import { unlink } from 'fs/promises'
import { Client } from 'undici'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { FeedTheBeastClient } from '../clients/FeedTheBeastClient'
import { InteroperableDispatcher } from '../dispatchers/dispatcher'
import { missing } from '../util/fs'
import { Inject } from '../util/objectRegistry'
import { ExposeServiceKey, StatefulService } from './Service'

@ExposeServiceKey(FeedTheBeastServiceKey)
export class FeedTheBeastService extends StatefulService<FeedTheBeastState> implements IFeedTheBeastService {
  private client: FeedTheBeastClient

  private db: ClassicLevel<string, CachedFTBModpackVersionManifest>

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => new FeedTheBeastState(), async () => {
      const legacyPath = this.getAppDataPath('ftb.json')
      if (!await missing(legacyPath)) {
        const content: {
          caches: CachedFTBModpackVersionManifest[]
        } = await readJSON(legacyPath)
        const batch = this.db.batch()
        for (const m of content.caches) {
          batch.put(m.id.toString(), m)
        }
        await batch.write()
        await unlink(legacyPath)
      }
    })
    const cache = new ClassicLevel<string, CachedFTBModpackVersionManifest>(this.getAppDataPath('ftb-cache'), {
      valueEncoding: 'json',
    })
    this.db = cache

    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, options) => {
      if (origin.host === 'api.modpacks.ch') {
        return new InteroperableDispatcher([
          (options) => {
            if (!options.headers) {
              options.headers = {
                'User-Agent': 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36 OverwolfClient/0.195.0.18',
                Origin: 'overwolf-extension://cmogmmciplgmocnhikmphehmeecmpaggknkjlbag',
              }
            }
          },
        ], new Client(origin, {
          ...options,
          pipelining: 6,
        }))
      }
    })

    this.client = new FeedTheBeastClient(dispatcher)
  }

  async getAllCachedModpackVersions(): Promise<CachedFTBModpackVersionManifest[]> {
    return await this.db.values().all()
  }

  private async saveManifest(man: CachedFTBModpackVersionManifest) {
    await this.db.put(man.id.toString(), man)
  }

  async searchModpacks(options?: SearchFTBModpackOptions): Promise<FTBModpacksResult> {
    this.log(`Try search modpacks keyword=${options?.keyword ?? ''}`)
    const result: FTBModpacksResult = await this.client.searchModpacks(options)
    this.log(`Got ${result.total} modpacks with keyword=${options?.keyword ?? ''}`)
    return result
  }

  async getFeaturedModpacks(): Promise<FTBModpacksResult> {
    this.log('Try get featured modpacks')
    const result: FTBModpacksResult = await this.client.getFeaturedModpacks()
    this.log(`Got ${result.total} featured modpacks`)
    return result
  }

  async getModpackManifest(id: number): Promise<FTBModpackManifest> {
    this.log(`Try get modpack for id=${id}`)
    const result: FTBModpackManifest = await this.client.getModpackManifest(id)
    this.log(`Got modpack for id=${id}`)
    return result
  }

  async getModpackVersionManifest({ modpack, version }: GetFTBModpackVersionOptions): Promise<FTBModpackVersionManifest> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    this.log(`Try get modpack version for modpackId=${modpackId}, versionId=${version.id}`)
    const existed = await this.db.get(version.id.toString()).catch(() => undefined)
    if (existed && existed.updated >= version.updated) {
      return existed
    }
    const modpackManifest = typeof modpack === 'number' ? await this.getModpackManifest(modpack) : modpack
    const result: FTBModpackVersionManifest = await this.client.getModpackVersionManifest({ modpack, version })
    if ((result as any).status === 'error') {
      throw new Error(`Fail to get manifest for ${modpackId} ${version.id}`)
    }
    this.saveManifest({
      ...result,
      iconUrl: modpackManifest.art.find(a => a.type === 'square')?.url ?? modpackManifest.art[0].url ?? '',
      projectName: modpackManifest.name,
      authors: modpackManifest.authors,
    })
    this.log(`Got modpack version for modpackId=${modpackId}, versionId=${version.id}`)
    return result
  }

  async getModpackVersionChangelog({ modpack, version }: GetFTBModpackVersionOptions): Promise<string> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    this.log(`Try get modpack changelog for modpackId=${modpackId}, versionId=${version.id}`)
    const content = await this.client.getModpackVersionChangelog({ modpack, version })
    this.log(`Got modpack changelog for modpackId=${modpackId}, versionId=${version.id}`)
    return content
  }

  async removeModpackCache(id: number) {
    await this.db.del(id.toString())
  }
}
