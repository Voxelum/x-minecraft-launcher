import { ResourceDomain } from '../ResourceDomain'
import { ResourceType } from '../ResourceType'
import type { IResourceParser } from './index'

export const shaderPackParser: IResourceParser<{}> = {
  type: ResourceType.ShaderPack,
  domain: ResourceDomain.ShaderPacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: async (fs) => {
    const shaderPropertiesExisted = await fs.existsFile('shaders/shaders.properties')
    if (shaderPropertiesExisted) {
      return {}
    }
    throw new Error()
  },
  getSuggestedName: () => '',
  getUri: (_) => [],
}
