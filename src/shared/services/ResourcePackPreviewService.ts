import type { BlockModel } from '@xmcl/resourcepack'
import { ServiceKey, ServiceTemplate } from './Service'
export interface BlockStateJson {
  name: string
  variants: {
    [variant: string]: {
      model: string
    } | Array<{
      model: string
    }>
  }
}
export interface ResourcePackPreviewService {
  loadModel(modelPath: string): Promise<{
    model: BlockModel.Resolved
    textures: Record<string, {
      url: string
    }>
  }>
  getBlockStates(): Promise<BlockStateJson[]>
}

export const ResourcePackPreviewServiceKey: ServiceKey<ResourcePackPreviewService> = 'ResourcePackPreviewService'
export const ResourcePackPreviewServiceMethods: ServiceTemplate<ResourcePackPreviewService> = {
  loadModel: undefined,
  getBlockStates: undefined
}
