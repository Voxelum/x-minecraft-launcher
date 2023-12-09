import { RuntimeVersions } from '@xmcl/runtime-api'

export function getExtensionItemsFromRuntime(runtime: RuntimeVersions) {
  const items = [
    {
      avatar: 'http://launcher/icons/minecraft',
      title: 'Minecraft',
      text: runtime.minecraft,
    },
  ]
  if (runtime.forge) {
    items.push({
      avatar: 'http://launcher/icons/forge',
      title: 'Forge',
      text: runtime.forge,
    })
  }
  if (runtime.fabricLoader) {
    items.push({
      avatar: 'http://launcher/icons/fabric',
      title: 'Fabric',
      text: runtime.fabricLoader,
    })
  }
  if (runtime.quiltLoader) {
    items.push({
      avatar: 'http://launcher/icons/quilt',
      title: 'Quilt',
      text: runtime.quiltLoader,
    })
  }
  if (runtime.neoForged) {
    items.push({
      avatar: 'http://launcher/icons/neoForged',
      title: 'NeoForged',
      text: runtime.neoForged,
    })
  }
  if (runtime.optifine) {
    items.push({
      avatar: 'http://launcher/icons/optifine',
      title: 'Optifine',
      text: runtime.optifine,
    })
  }
  return items
}
