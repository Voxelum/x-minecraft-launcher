import { isRangeCompatible } from '@xmcl/runtime-api'
import { computed, Ref } from 'vue'

export function useRangeCompatible(range: Ref<string>, version: Ref<string>) {
  return { compatible: computed(() => isRangeCompatible(range.value, version.value)) }
}
