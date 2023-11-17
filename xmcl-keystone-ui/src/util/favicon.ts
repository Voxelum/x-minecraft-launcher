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
      return 'http://launcher/icons/forge'
    } else if (instance.runtime.neoForged) {
      return 'http://launcher/icons/neoForged'
    } else if (instance.runtime.labyMod) {
      return 'http://launcher/icons/labyMod'
    } else if (instance.runtime.fabricLoader) {
      return 'http://launcher/icons/fabric'
    } else if (instance.runtime.quiltLoader) {
      return 'http://launcher/icons/quilt'
    } else if (instance.runtime.optifine) {
      return 'http://launcher/icons/optifine'
    } else if (instance.runtime.minecraft) {
      return 'http://launcher/icons/minecraft'
    } else {
      return 'http://launcher/icons/craftingTable'
    }
  }
  return instance.icon
}
