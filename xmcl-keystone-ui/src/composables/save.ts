import { useService } from '@/composables'
import { Instance, InstanceSavesServiceKey, Saves } from '@xmcl/runtime-api'
import { Ref, InjectionKey } from 'vue'
import { useState } from './syncableState'

export const kInstanceSave: InjectionKey<ReturnType<typeof useInstanceSaves>> = Symbol('InstanceSave')

export function useInstanceSaves(instancePath: Ref<string>) {
  const { watch } = useService(InstanceSavesServiceKey)
  const { state, isValidating, error } = useState(() => instancePath.value ? watch(instancePath.value) : undefined, Saves)

  const saves = computed(() => state.value?.saves || [])

  return {
    saves,
    isValidating,
    error,
  }
}
