import { FabricModMetadata, readFabricMod } from '@xmcl/mod-parser'
import { ResourceType, ResourceDomain } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const fabricModParser: ResourceParser<FabricModMetadata> = ({
  type: ResourceType.Fabric,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.icon) {
      return fs.readFile(meta.icon)
    }
    return Promise.resolve(undefined)
  },
  parseMetadata: async fs => readFabricMod(fs),
  getSuggestedName: (meta) => {
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
  getUri: meta => [`fabric:///${meta.id}/${meta.version}`],
})
