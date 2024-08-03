import { BuiltinImages } from '@/constant'
import { RuntimeVersions } from '@xmcl/runtime-api'

export function getExtensionItemsFromRuntime(runtime: RuntimeVersions) {
  const items = [
    {
      avatar: BuiltinImages.minecraft,
      title: 'Minecraft',
      text: runtime.minecraft,
    },
  ]
  if (runtime.forge) {
    items.push({
      avatar: BuiltinImages.forge,
      title: 'Forge',
      text: runtime.forge,
    })
  }
  if (runtime.fabricLoader) {
    items.push({
      avatar: BuiltinImages.fabric,
      title: 'Fabric',
      text: runtime.fabricLoader,
    })
  }
  if (runtime.quiltLoader) {
    items.push({
      avatar: BuiltinImages.quilt,
      title: 'Quilt',
      text: runtime.quiltLoader,
    })
  }
  if (runtime.neoForged) {
    items.push({
      avatar: BuiltinImages.neoForged,
      title: 'NeoForged',
      text: runtime.neoForged,
    })
  }
  if (runtime.optifine) {
    items.push({
      avatar: BuiltinImages.optifine,
      title: 'Optifine',
      text: runtime.optifine,
    })
  }
  if (runtime.labyMod) {
    items.push({
      avatar: BuiltinImages.labyMod,
      title: 'LabyMod',
      text: runtime.labyMod,
    })
  }
  return items
}
