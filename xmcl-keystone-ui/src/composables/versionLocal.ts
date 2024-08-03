import { useService } from '@/composables'
import { VersionServiceKey, LocalVersions, VersionHeader, RuntimeVersions } from '@xmcl/runtime-api'
import { computed, InjectionKey } from 'vue'
import { useState } from './syncableState'
import { MaybeRef, get } from '@vueuse/core'
import { BuiltinImages } from '@/constant'

export const kLocalVersions: InjectionKey<ReturnType<typeof useLocalVersions>> = Symbol('LocalVersions')

export function useLocalVersions() {
  const { getLocalVersions } = useService(VersionServiceKey)
  const { state, isValidating, error } = useState(getLocalVersions, LocalVersions)
  const versions = computed(() => state.value?.local ?? [])
  const servers = computed(() => state.value?.servers ?? [])

  return {
    versions,
    servers,
    isValidating,
    error,
  }
}

export function useVersionsWithIcon(_version: MaybeRef<VersionHeader | RuntimeVersions>) {
  const versions = computed(() => {
    const version = get(_version)
    const result: { icon: string; text: string }[] = []
    if (version.minecraft) {
      result.push({
        icon: BuiltinImages.minecraft,
        text: version.minecraft,
      })
    }
    if (version.forge) {
      result.push({
        icon: BuiltinImages.forge,
        text: version.forge,
      })
    }
    const fabric = 'fabricLoader' in version ? version.fabricLoader : version.fabric
    if (fabric) {
      result.push({
        icon: BuiltinImages.fabric,
        text: fabric,
      })
    }
    const quilt = 'quilt' in version ? version.quilt : version.quiltLoader
    if (quilt) {
      result.push({
        icon: BuiltinImages.quilt,
        text: quilt,
      })
    }
    if (version.optifine) {
      result.push({
        icon: BuiltinImages.optifine,
        text: version.optifine,
      })
    }
    if (version.neoForged) {
      result.push({
        icon: BuiltinImages.neoForged,
        text: version.neoForged,
      })
    }
    return result
  })
  return versions
}
