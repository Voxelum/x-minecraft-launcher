import { readForgeModToml } from '@xmcl/mod-parser'
import { NeoforgeMetadata, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'

export const neoforgeModParser: IResourceParser<NeoforgeMetadata> = ({
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
  getUri: meta => {
    const urls: string[] = []
    urls.push(`neoforge:${meta.modid}:${meta.version}`)
    return urls
  },
})
