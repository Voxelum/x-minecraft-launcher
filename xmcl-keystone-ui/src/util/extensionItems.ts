import { BUILTIN_IMAGES } from '@/constant'
import { RuntimeVersions } from '@xmcl/runtime-api'

export function getExtensionItemsFromRuntime(runtime: RuntimeVersions) {
  const items = [
    {
      avatar: BUILTIN_IMAGES.minecraft,
      title: 'Minecraft',
      text: runtime.minecraft,
    },
  ]
  if (runtime.forge) {
    items.push({
      avatar: BUILTIN_IMAGES.forge,
      title: 'Forge',
      text: runtime.forge,
    })
  }
  if (runtime.fabricLoader) {
    items.push({
      avatar: BUILTIN_IMAGES.fabric,
      title: 'Fabric',
      text: runtime.fabricLoader,
    })
  }
  if (runtime.quiltLoader) {
    items.push({
      avatar: BUILTIN_IMAGES.quilt,
      title: 'Quilt',
      text: runtime.quiltLoader,
    })
  }
  if (runtime.neoForged) {
    items.push({
      avatar: BUILTIN_IMAGES.neoForged,
      title: 'NeoForged',
      text: runtime.neoForged,
    })
  }
  if (runtime.optifine) {
    items.push({
      avatar: BUILTIN_IMAGES.optifine,
      title: 'Optifine',
      text: runtime.optifine,
    })
  }
  if (runtime.labyMod) {
    items.push({
      avatar: BUILTIN_IMAGES.labyMod,
      title: 'LabyMod',
      text: runtime.labyMod,
    })
  }
  return items
}
