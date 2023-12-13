import { ResourceDomain, ResourceSaveMetadata, ResourceType } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'
import { findLevelRootDirectory, readResourceSaveMetadata } from '~/save/save'

export const saveParser: IResourceParser<ResourceSaveMetadata> = ({
  type: ResourceType.Save,
  domain: ResourceDomain.Saves,
  ext: '.zip',
  parseIcon: async (meta, fs) => fs.readFile('icon.png'),
  parseMetadata: async fs => {
    const root = await findLevelRootDirectory(fs, '')
    if (!root) throw new Error()
    fs.cd(root)
    return readResourceSaveMetadata(fs, root)
  },
  getSuggestedName: meta => meta.levelName,
  getUri: (_) => [],
})
