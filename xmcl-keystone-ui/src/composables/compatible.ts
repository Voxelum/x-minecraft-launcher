import { computed, Ref } from 'vue'
import { Resource, isModCompatible, Instance, isRangeCompatible } from '@xmcl/runtime-api'

export function useRangeCompatible(range: Ref<string>, version: Ref<string>) {
  return { compatible: computed(() => isRangeCompatible(range.value, version.value)) }
}
