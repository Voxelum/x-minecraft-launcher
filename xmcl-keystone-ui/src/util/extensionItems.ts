import { BuiltinImages } from '@/constant'
import { PartialRuntimeVersions } from '@xmcl/instance'
import { resolveFabricCustomLoader } from '@/composables/modloaderCustom'

export function getExtensionItemsFromRuntime(runtime: PartialRuntimeVersions, version?: string) {
  const items: { avatar?: string; title: string; text: string; icon?: string; color?: string }[] = [
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
    const custom = resolveFabricCustomLoader(runtime.minecraft, runtime.fabricLoader)
    items.push({
      avatar: custom?.icon || BuiltinImages.fabric,
      title: custom?.name || 'Fabric',
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
  if (version && !runtime.forge && !runtime.fabricLoader && !runtime.quiltLoader && !runtime.neoForged && !runtime.optifine && !runtime.labyMod) {
    let custom: { name: string; icon?: string } | undefined
    try {
      const storage = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
          ? (globalThis as any).localStorage
          : (typeof localStorage !== 'undefined' ? localStorage : undefined))
      const raw = storage
        ? (storage.getItem('xmcl_user_custom_modloaders') || storage.getItem('modloaders_custom_v1'))
        : null
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          const match = list.find((c: any) =>
            c.id &&
            !['forge', 'fabric', 'quilt', 'neoforge', 'optifine', 'labymod'].includes(c.id) &&
            (!c.gameVersions || c.gameVersions.length === 0 || !runtime.minecraft || c.gameVersions.includes(runtime.minecraft)) &&
            (c.versions?.some((v: any) => v.version === version) ||
            version.toLowerCase().includes(c.id.toLowerCase()))
          )
          if (match) custom = { name: match.name, icon: match.icon }
        }
      }
    } catch {}

    items.push({
      icon: custom?.icon ? undefined : 'extension',
      avatar: custom?.icon,
      title: custom?.name || 'Mod Loader',
      text: version,
    })
  }
  return items as { avatar?: string; title: string; text: string; icon?: string; color?: string }[]
}
