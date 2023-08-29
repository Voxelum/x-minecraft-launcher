import { getModsCompatiblity, resolveDepsCompatible } from '@/util/modCompatible'
import { ModDependencies } from '@/util/modDependencies'
import { Ref } from 'vue'

export function useModCompatibility(dependencies: Ref<ModDependencies>, runtime: Ref<Record<string, string>>) {
  const compatibility = computed(() => getModsCompatiblity(dependencies.value, runtime.value))
  const isCompatible = computed(() => resolveDepsCompatible(compatibility.value))

  return {
    compatibility,
    isCompatible,
  }
}
