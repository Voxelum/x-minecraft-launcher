import { readForgeMod } from '@xmcl/mod-parser'
import { ForgeModCommonMetadata, ResourceType, ResourceDomain, normalizeForgeModMetadata } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const forgeModParser: ResourceParser<ForgeModCommonMetadata> = ({
  type: ResourceType.Forge,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.logoFile) {
      return fs.readFile(meta.logoFile)
    }
    return undefined
  },
  parseMetadata: fs => readForgeMod(fs).then(normalizeForgeModMetadata),
  getSuggestedName: (meta) => {
    let name = `${meta.name || meta.modid}`
    if (meta.version) {
      name += `- ${meta.version}`
    }
    return name
  },
  getUri: meta => {
    const urls: string[] = []
    for (const m of meta.mcmodInfo) {
      urls.push(`forge:///${m.modid}/${m.version}`)
    }
    for (const m of meta.modsToml) {
      urls.push(`forge:///${m.modid}/${m.version}`)
    }
    for (const m of meta.modAnnotations) {
      if (m.modid && m.version) {
        const uri = `forge:///${m.modid}/${m.version}`
        if (urls.indexOf(uri) === -1) {
          urls.push(uri)
        }
      }
    }
    if (meta.manifestMetadata && meta.manifestMetadata.modid && meta.manifestMetadata.version) {
      const m = meta.manifestMetadata
      const uri = `forge:///${m.modid}/${m.version}`
      if (urls.indexOf(uri) === -1) {
        urls.push(uri)
      }
    }
    return urls
  },
})
