import { injection } from '@/util/inject'
import { getModsCompatiblity, resolveDepsCompatible } from '@/util/modCompatible'
import { Ref } from 'vue'
import { ModItem } from './instanceModItems'

export function useModCompatibility(item: Ref<ModItem>, runtime: Ref<Record<string, string>>) {
  const compatibility = computed(() => getModsCompatiblity(item.value.mod.dependencies, runtime.value))
  const isCompatible = computed(() => resolveDepsCompatible(compatibility.value))

  return {
    compatibility,
    isCompatible,
  }
}
