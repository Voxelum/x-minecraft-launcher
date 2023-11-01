import { RuntimeVersions } from '@xmcl/runtime-api'

export function getExtensionItemsFromRuntime(runtime: RuntimeVersions) {
  const items = [
    {
      avatar: 'image://builtin/minecraft',
      title: 'Minecraft',
      text: runtime.minecraft,
    },
  ]
  if (runtime.forge) {
    items.push({
      avatar: 'image://builtin/forge',
      title: 'Forge',
      text: runtime.forge,
    })
  }
  if (runtime.fabricLoader) {
    items.push({
      avatar: 'image://builtin/fabric',
      title: 'Fabric',
      text: runtime.fabricLoader,
    })
  }
  if (runtime.quiltLoader) {
    items.push({
      avatar: 'image://builtin/quilt',
      title: 'Quilt',
      text: runtime.quiltLoader,
    })
  }
  if (runtime.neoForged) {
    items.push({
      avatar: 'image://builtin/neoforged',
      title: 'NeoForged',
      text: runtime.neoForged,
    })
  }
  if (runtime.optifine) {
    items.push({
      avatar: 'image://builtin/optifine',
      title: 'Optifine',
      text: runtime.optifine,
    })
  }
  return items
}
