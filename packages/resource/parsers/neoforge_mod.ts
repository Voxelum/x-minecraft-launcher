import { readForgeModToml } from '@xmcl/mod-parser'
import { NeoforgeMetadata } from '../mod'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import type { IResourceParser } from './index'

export const neoforgeModParser: IResourceParser<NeoforgeMetadata> = {
  type: ResourceType.Neoforge,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.logoFile) {
      return fs.readFile(meta.logoFile)
    }
    return undefined
  },
  parseMetadata: async (fs, fileName) => {
    const mods = await readForgeModToml(fs, undefined, 'neoforge.mods.toml')
    if (mods.length === 0) {
      throw new Error()
    }
    return {
      ...mods[0],
      children: mods.slice(1),
    }
  },
  getSuggestedName: (meta) => {
    let name = `${meta.displayName || meta.modid}`
    if (meta.version) {
      name += `-${meta.version}`
    }
    return name
  },
  getUri: (meta) => {
    const urls: string[] = []
    urls.push(`neoforge:${meta.modid}:${meta.version}`)
    return urls
  },
}
