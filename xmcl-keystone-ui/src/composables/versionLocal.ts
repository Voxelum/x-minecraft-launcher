import { useService } from '@/composables'
import { VersionServiceKey, LocalVersions } from '@xmcl/runtime-api'
import { computed, InjectionKey } from 'vue'
import { useState } from './syncableState'

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
