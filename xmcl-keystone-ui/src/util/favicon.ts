import { InstanceData, ServerStatus } from '@xmcl/runtime-api'
import { BuiltinImages } from '@/constant'

export function getInstanceIcon(instance: InstanceData, status: ServerStatus | undefined) {
  if (status?.favicon && status?.favicon !== BuiltinImages.unknownServer) {
    return status?.favicon
  } else if (instance.server) {
    return BuiltinImages.unknownServer
  }
  if (!instance.icon) {
    if (instance.runtime.forge) {
      return BuiltinImages.forge
    } else if (instance.runtime.neoForged) {
      return BuiltinImages.neoForged
    } else if (instance.runtime.labyMod) {
      return BuiltinImages.labyMod
    } else if (instance.runtime.fabricLoader) {
      return BuiltinImages.fabric
    } else if (instance.runtime.quiltLoader) {
      return BuiltinImages.quilt
    } else if (instance.runtime.optifine) {
      return BuiltinImages.optifine
    } else if (instance.runtime.minecraft) {
      return BuiltinImages.minecraft
    } else {
      return BuiltinImages.craftingTable
    }
  }
  return instance.icon
}
