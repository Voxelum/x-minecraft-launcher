import { Resource, ResourceLocation } from './resourcePack'
import { ResourceLoader } from './resourceManager'
import { BlockModel } from './format'

/**
 * The model loader load the resource
 */
export class ModelLoader {
  static findRealTexturePath(model: BlockModel.Resolved, variantKey: string) {
    let texturePath = model.textures[variantKey] as string
    while (texturePath.startsWith('#')) {
      const next = model.textures[texturePath.substring(1, texturePath.length)]
      if (!next) {
        return undefined
      }
      texturePath = next
    }
    return texturePath
  }

  /**
   * All required texture raw resources
   */
  readonly textures: Record<string, Resource> = {}
  /**
   * All the resolved model
   */
  readonly models: Record<string, BlockModel.Resolved> = {}

  /**
   * @param loader The resource loader
   */
  constructor(readonly loader: ResourceLoader) {}

  /**
   * Load a model by search its parent. It will throw an error if the model is not found.
   */
  async loadModel(modelPath: string, folder = 'block'): Promise<BlockModel.Resolved> {
    const path = ResourceLocation.deconstruct(modelPath, folder)
    const resourceLocation = ResourceLocation.ofModelPath(path)

    const cacheName = resourceLocation.toString()

    if (this.models[cacheName] !== undefined) {
      return this.models[cacheName]
    }

    const resource = await this.loader.get(resourceLocation)
    if (!resource) {
      throw new Error(`Model ${modelPath} (${resourceLocation}) not found`)
    }
    const baseModel = JSON.parse(await resource.read('utf-8')) as BlockModel

    if (!baseModel.textures) {
      baseModel.textures = {}
    }

    if (baseModel.parent) {
      const parentModel = await this.loadModel(baseModel.parent, '')
      if (!parentModel) {
        throw new Error(`Missing parent model ${baseModel.parent} for ${resource.location}`)
      }
      if (!baseModel.elements) {
        baseModel.elements = parentModel.elements
      }
      if (!baseModel.ambientocclusion) {
        baseModel.ambientocclusion = parentModel.ambientocclusion
      }
      if (!baseModel.display) {
        baseModel.display = parentModel.display
      }
      if (!baseModel.overrides) {
        baseModel.overrides = parentModel.overrides
      }

      if (parentModel.textures) {
        Object.assign(baseModel.textures, parentModel.textures)
      }
    }

    baseModel.ambientocclusion = baseModel.ambientocclusion || false
    baseModel.overrides = baseModel.overrides || []

    delete baseModel.parent

    const model: BlockModel.Resolved = baseModel as any

    const reg = this.textures
    for (const variant of Object.keys(model.textures)) {
      const texPath = ModelLoader.findRealTexturePath(model, variant)
      if (texPath) {
        const load = await this.loader.get(ResourceLocation.ofTexturePath(texPath))
        if (load) {
          reg[texPath] = load
        }
      }
    }

    this.models[cacheName] = model
    return model
  }
}
