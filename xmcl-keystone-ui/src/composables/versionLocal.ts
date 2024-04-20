import { useService } from '@/composables'
import { VersionServiceKey, LocalVersions, LocalVersionHeader, RuntimeVersions } from '@xmcl/runtime-api'
import { computed, InjectionKey } from 'vue'
import { useState } from './syncableState'
import { MaybeRef, get } from '@vueuse/core'

export const kLocalVersions: InjectionKey<ReturnType<typeof useLocalVersions>> = Symbol('LocalVersions')

export function useLocalVersions() {
  const { getLocalVersions } = useService(VersionServiceKey)
  const { state, isValidating, error } = useState(getLocalVersions, LocalVersions)
  const versions = computed(() => state.value?.local ?? [])

  return {
    versions,
    isValidating,
    error,
  }
}

export function useVersionsWithIcon(_version: MaybeRef<LocalVersionHeader | RuntimeVersions>) {
  const versions = computed(() => {
    const version = get(_version)
    const result: { icon: string; text: string }[] = []
    if (version.minecraft) {
      result.push({
        icon: 'http://launcher/icons/minecraft',
        text: version.minecraft,
      })
    }
    if (version.forge) {
      result.push({
        icon: 'http://launcher/icons/forge',
        text: version.forge,
      })
    }
    const fabric = 'fabricLoader' in version ? version.fabricLoader : version.fabric
    if (fabric) {
      result.push({
        icon: 'http://launcher/icons/fabric',
        text: fabric,
      })
    }
    const quilt = 'quilt' in version ? version.quilt : version.quiltLoader
    if (quilt) {
      result.push({
        icon: 'http://launcher/icons/quilt',
        text: quilt,
      })
    }
    if (version.optifine) {
      result.push({
        icon: 'http://launcher/icons/optifine',
        text: version.optifine,
      })
    }
    if (version.neoForged) {
      result.push({
        icon: 'http://launcher/icons/neoForged',
        text: version.neoForged,
      })
    }
    return result
  })
  return versions
}
