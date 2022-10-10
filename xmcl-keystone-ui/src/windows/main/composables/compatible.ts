import { computed, Ref } from '@vue/composition-api'
import { Resource, isModCompatible, Instance, isRangeCompatible } from '@xmcl/runtime-api'

export function useRangeCompatible(range: Ref<string>, version: Ref<string>) {
  return { compatible: computed(() => isRangeCompatible(range.value, version.value)) }
}
