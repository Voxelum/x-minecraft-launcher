import { QuiltModMetadata, readQuiltMod } from '@xmcl/mod-parser'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import type { IResourceParser } from './index'

export const quiltModParser: IResourceParser<QuiltModMetadata> = {
  type: ResourceType.Quilt,
  domain: ResourceDomain.Mods,
  ext: '.jar',
  parseIcon: async (meta, fs) => {
    if (meta.quilt_loader.metadata?.icon) {
      const icon = meta.quilt_loader.metadata.icon
      if (typeof icon === 'string') {
        return fs.readFile(icon)
      }
      const icons = Object.values(icon)
      return fs.readFile(icons[icons.length - 1])
    }
    return Promise.resolve(undefined)
  },
  parseMetadata: async (fs) => readQuiltMod(fs),
  getSuggestedName: (meta) => {
    let name = ''
    if (meta.quilt_loader.metadata?.name) {
      name += meta.quilt_loader.metadata.name
    } else {
      name += meta.quilt_loader.id
    }

    name += `-${meta.quilt_loader.version}`

    return name
  },
  getUri: (meta) => [`quilt:${meta.quilt_loader.id}:${meta.quilt_loader.version}`],
}
