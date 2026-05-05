import { PackMeta, readIcon, readPackMeta } from '@xmcl/resourcepack'
import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import type { IResourceParser } from './index'

export const resourcePackParser: IResourceParser<PackMeta.Pack> = {
  type: ResourceType.ResourcePack,
  domain: ResourceDomain.ResourcePacks,
  ext: '.zip',
  parseIcon: async (meta, fs) => readIcon(fs),
  parseMetadata: (fs) => readPackMeta(fs),
  getSuggestedName: () => '',
  getUri: (_) => [],
}
