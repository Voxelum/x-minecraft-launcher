import { computed, Ref } from '@vue/composition-api'
import { Instance } from '/@shared/entities/instance'
import { Resource } from '/@shared/entities/resource.schema'
import { isCompatible } from '/@shared/util/modCompatible'

export function useCompatible(resource: Ref<Resource>, runtime: Ref<Instance['runtime']>) {
  const compatible = computed(() => isCompatible(resource.value, runtime.value))
  return { compatible }
}
