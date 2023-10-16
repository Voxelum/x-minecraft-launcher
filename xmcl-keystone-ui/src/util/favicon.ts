import { InstanceData, ServerStatus } from '@xmcl/runtime-api'

import unknownServer from '@/assets/unknown_server.png'
import { Ref } from 'vue'

export function getInstanceIcon(instance: InstanceData, status: ServerStatus | undefined) {
  if (status?.favicon && status?.favicon !== unknownServer) {
    return status?.favicon
  } else if (instance.server) {
    return unknownServer
  }
  if (!instance.icon) {
    if (instance.runtime.forge) {
      return 'image://builtin/forge'
    } else if (instance.runtime.neoForged) {
      return 'image://builtin/neoForged'
    } else if (instance.runtime.labyMod) {
      return 'image://builtin/labyMod'
    } else if (instance.runtime.fabricLoader) {
      return 'image://builtin/fabric'
    } else if (instance.runtime.quiltLoader) {
      return 'image://builtin/quilt'
    } else if (instance.runtime.optifine) {
      return 'image://builtin/optifine'
    } else if (instance.runtime.minecraft) {
      return 'image://builtin/minecraft'
    } else {
      return 'image://builtin/craftingTable'
    }
  }
  return instance.icon
}
