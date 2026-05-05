import { FabricModMetadata, readFabricMod } from '@xmcl/mod-parser'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import type { IResourceParser } from './index'

export const fabricModParser: IResourceParser<FabricModMetadata | FabricModMetadata[]> = {
  type: ResourceType.Fabric,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta instanceof Array) {
      meta = meta[0]
    }
    if (meta.icon) {
      return fs.readFile(meta.icon)
    }
    return Promise.resolve(undefined)
  },
  parseMetadata: async (fs) => {
    const result = await readFabricMod(fs)
    if (result.jars) {
      const nested = await Promise.all(
        result.jars.map(async (jar) => {
          try {
            return await readFabricMod(await fs.readFile(jar.file))
          } catch {
            return undefined
          }
        }),
      )
      return [result, ...nested.filter((v): v is FabricModMetadata => !!v)]
    }
    return result
  },
  getSuggestedName: (meta) => {
    if (meta instanceof Array) {
      meta = meta[0]
    }
    let name = ''
    if (typeof meta.name === 'string') {
      name += meta.name
    } else if (typeof meta.id === 'string') {
      name += meta.id
    }
    if (typeof meta.version === 'string') {
      name += `-${meta.version}`
    } else {
      name += '-0.0.0'
    }
    return name
  },
  getUri: (meta) => {
    if (meta instanceof Array) {
      meta = meta[0]
    }
    return [`fabric:${meta.id}:${meta.version}`]
  },
}
