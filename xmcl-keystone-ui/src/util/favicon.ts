import { ServerStatus } from '@xmcl/runtime-api'
import { BuiltinImages } from '@/constant'
import { InstanceData } from '@xmcl/instance'
import { resolveFabricCustomLoader, DEFAULT_LOADER_IDS, KNOWN_LOADER_ICONS, KNOWN_LOADER_METAS } from '@/composables/modloaderCustom'

export function getInstanceIcon(instance: InstanceData, status: ServerStatus | undefined) {
  if (status?.favicon && status?.favicon !== BuiltinImages.unknownServer) {
    return status?.favicon
  } else if (instance.server) {
    return BuiltinImages.unknownServer
  }

  let useInstanceIcon = Boolean(instance.icon)
  if (useInstanceIcon && instance.icon) {
    const mediaPath = instance.icon.startsWith('http://launcher/media') || instance.icon.startsWith('image://launcher')
      ? (() => { try { return new URL(instance.icon).searchParams.get('path') } catch { return undefined } })()
      : undefined
    const isBundled = instance.icon.startsWith('@/assets/') || instance.icon.startsWith('/assets/') || instance.icon.startsWith('assets/')
      || Boolean(mediaPath && (mediaPath.startsWith('@/assets/') || mediaPath.startsWith('/assets/') || mediaPath.startsWith('assets/')))
    if (
      isBundled ||
      Object.values(BuiltinImages).includes(instance.icon)
    ) {
      useInstanceIcon = false
    } else if (instance.icon === KNOWN_LOADER_ICONS.babric) {
      const isBabric = instance.runtime?.fabricLoader && (instance.runtime?.minecraft === 'b1.7.3' || instance.runtime?.minecraft === 'b1.7.2')
      if (!isBabric) useInstanceIcon = false
    } else if (instance.icon === KNOWN_LOADER_ICONS['legacy-fabric']) {
      const isLegacy = instance.runtime?.fabricLoader && KNOWN_LOADER_METAS['legacy-fabric'].gameVersions.includes(instance.runtime?.minecraft)
      if (!isLegacy) useInstanceIcon = false
    } else if (instance.icon === KNOWN_LOADER_ICONS.ornithe) {
      const isOrnithe = instance.runtime?.fabricLoader && KNOWN_LOADER_METAS.ornithe.gameVersions.includes(instance.runtime?.minecraft)
      if (!isOrnithe) useInstanceIcon = false
    } else if (instance.icon === BuiltinImages.fabric) {
      if (!instance.runtime?.fabricLoader || resolveFabricCustomLoader(instance.runtime?.minecraft, instance.runtime?.fabricLoader)) {
        useInstanceIcon = false
      }
    } else if (instance.icon === BuiltinImages.forge) {
      if (!instance.runtime?.forge) useInstanceIcon = false
    } else if (instance.icon === BuiltinImages.neoForged) {
      if (!instance.runtime?.neoForged) useInstanceIcon = false
    } else if (instance.icon === BuiltinImages.quilt) {
      if (!instance.runtime?.quiltLoader) useInstanceIcon = false
    } else if (instance.icon === BuiltinImages.optifine) {
      if (!instance.runtime?.optifine) useInstanceIcon = false
    } else if (instance.icon === BuiltinImages.labyMod) {
      if (!instance.runtime?.labyMod) useInstanceIcon = false
    }

    if (useInstanceIcon) {
      try {
        const storage = typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
            ? (globalThis as any).localStorage
            : (typeof localStorage !== 'undefined' ? localStorage : undefined))
        const customLoadersRaw = storage
          ? (storage.getItem('xmcl_user_custom_modloaders') || storage.getItem('modloaders_custom_v1'))
          : null
        if (customLoadersRaw) {
          const list = JSON.parse(customLoadersRaw)
          if (Array.isArray(list)) {
            const staleLoader = list.find((c: any) => c.icon && c.icon === instance.icon)
            if (staleLoader) {
              const isMatch =
                (instance.version && staleLoader.versions?.some((v: any) => v.version === instance.version)) ||
                (instance.version && staleLoader.id && instance.version.toLowerCase().includes(staleLoader.id.toLowerCase())) ||
                (instance.runtime?.fabricLoader && staleLoader.versions?.some((v: any) => v.version === instance.runtime.fabricLoader)) ||
                (instance.runtime?.neoForged && staleLoader.versions?.some((v: any) => v.version === instance.runtime.neoForged)) ||
                (instance.runtime?.forge && staleLoader.versions?.some((v: any) => v.version === instance.runtime.forge))
              if (!isMatch) {
                useInstanceIcon = false
              }
            }
          }
        }
      } catch {}
    }
  }

  if (!useInstanceIcon) {
    if (instance.edition === 'bedrock') {
      return BuiltinImages.bedrock
    }

    // 1. Standard default modloaders ALWAYS have top priority when active
    if (instance.runtime?.neoForged) {
      return BuiltinImages.neoForged
    } else if (instance.runtime?.forge) {
      return BuiltinImages.forge
    } else if (instance.runtime?.labyMod) {
      return BuiltinImages.labyMod
    } else if (instance.runtime?.fabricLoader) {
      const custom = resolveFabricCustomLoader(instance.runtime?.minecraft, instance.runtime?.fabricLoader)
      if (custom?.icon) {
        return custom.icon
      }
      return BuiltinImages.fabric
    } else if (instance.runtime?.quiltLoader) {
      return BuiltinImages.quilt
    } else if (instance.runtime?.optifine) {
      return BuiltinImages.optifine
    }

    // 2. Non-fabric custom modloaders (Cleanroom, LiteLoader, etc.)
    try {
      const storage = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : (typeof globalThis !== 'undefined' && (globalThis as any).localStorage
          ? (globalThis as any).localStorage
          : (typeof localStorage !== 'undefined' ? localStorage : undefined))
      const customLoadersRaw = storage
        ? (storage.getItem('xmcl_user_custom_modloaders') || storage.getItem('modloaders_custom_v1'))
        : null
      if (customLoadersRaw) {
        const list = JSON.parse(customLoadersRaw)
        if (Array.isArray(list)) {
          const matched = list.find((c: any) =>
            c.id &&
            !DEFAULT_LOADER_IDS.includes(c.id) &&
            ((instance.version && (c.versions?.some((v: any) => v.version === instance.version) || instance.version.toLowerCase().includes(c.id.toLowerCase()) || instance.version.toLowerCase().includes((c.name || '').toLowerCase()))) ||
             (instance.name && (instance.name.toLowerCase().includes(c.id.toLowerCase()) || instance.name.toLowerCase().includes((c.name || '').toLowerCase()))))
          )
          if (matched?.icon && matched.icon !== BuiltinImages.craftingTable) {
            return matched.icon
          }
        }
      }
    } catch {}

    if (instance.runtime?.minecraft) {
      return BuiltinImages.minecraft
    }
    return BuiltinImages.craftingTable
  }

  return instance.icon
}
