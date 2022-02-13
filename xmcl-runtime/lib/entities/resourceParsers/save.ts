import { ResourceDomain, ResourceSaveMetadata, ResourceType } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'
import { findLevelRootDirectory, readResourceSaveMetadata } from '../save'

export const saveParser: ResourceParser<ResourceSaveMetadata> = ({
  type: ResourceType.Save,
  domain: ResourceDomain.Saves,
  ext: '.zip',
  parseIcon: async (meta, fs) => fs.readFile('icon.png'),
  parseMetadata: async fs => {
    const root = await findLevelRootDirectory(fs, '')
    if (!root) throw new Error()
    return readResourceSaveMetadata(fs, root)
  },
  getSuggestedName: meta => meta.levelName,
  getUri: (_) => [],
})
