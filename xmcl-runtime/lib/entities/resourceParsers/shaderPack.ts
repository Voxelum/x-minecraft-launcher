import { ShaderPack, ResourceType, ResourceDomain } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const shaderPackParser: ResourceParser<ShaderPack> = {
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
