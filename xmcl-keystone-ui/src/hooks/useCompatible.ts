import { computed, Ref } from '@vue/composition-api'
import { Resource, isModCompatible, Instance } from '@xmcl/runtime-api'

export function useCompatible(resource: Ref<Resource>, runtime: Ref<Instance['runtime']>) {
  const compatible = computed(() => isModCompatible(resource.value, runtime.value))
  return { compatible }
}
