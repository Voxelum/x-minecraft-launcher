import { InstanceData, ServerStatus } from '@xmcl/runtime-api'
import { BUILTIN_IMAGES } from '@/constant'

export function getInstanceIcon(instance: InstanceData, status: ServerStatus | undefined) {
  if (status?.favicon && status?.favicon !== BUILTIN_IMAGES.unknownServer) {
    return status?.favicon
  } else if (instance.server) {
    return BUILTIN_IMAGES.unknownServer
  }
  if (!instance.icon) {
    if (instance.runtime.forge) {
      return BUILTIN_IMAGES.forge
    } else if (instance.runtime.neoForged) {
      return BUILTIN_IMAGES.neoForged
    } else if (instance.runtime.labyMod) {
      return BUILTIN_IMAGES.labyMod
    } else if (instance.runtime.fabricLoader) {
      return BUILTIN_IMAGES.fabric
    } else if (instance.runtime.quiltLoader) {
      return BUILTIN_IMAGES.quilt
    } else if (instance.runtime.optifine) {
      return BUILTIN_IMAGES.optifine
    } else if (instance.runtime.minecraft) {
      return BUILTIN_IMAGES.minecraft
    } else {
      return BUILTIN_IMAGES.craftingTable
    }
  }
  return instance.icon
}
