import { LiteloaderModMetadata, readLiteloaderMod } from '@xmcl/mod-parser'
import type { IResourceParser } from './index'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'

export const liteloaderModParser: IResourceParser<LiteloaderModMetadata> = {
  type: ResourceType.Liteloader,
  domain: ResourceDomain.Mods,
  ext: '.litemod',
  parseIcon: async () => undefined,
  parseMetadata: (fs) => readLiteloaderMod(fs),
  getSuggestedName: (meta) => {
    let name = ''
    if (typeof meta.name === 'string') {
      name += meta.name
    }
    if (typeof meta.mcversion === 'string') {
      name += `-${meta.mcversion}`
    }
    if (typeof meta.version === 'string') {
      name += `-${meta.version}`
    }
    if (typeof meta.revision === 'string' || typeof meta.revision === 'number') {
      name += `-${meta.revision}`
    }
    return name
  },
  getUri: (meta) => [`liteloader:${meta.name}:${meta.version}`],
}
