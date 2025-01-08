import { GameOptionsState, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceOptions: InjectionKey<ReturnType<typeof useInstanceOptions>> = Symbol('InstanceOptions')

export function useInstanceOptions(instancePath: Ref<string>) {
  const { watch: watchOptions } = useService(InstanceOptionsServiceKey)
  const { state, isValidating, error } = useState(() => instancePath.value ? watchOptions(instancePath.value) : undefined, GameOptionsState)

  return {
    gameOptions: state,
    isValidating,
    error,
  }
}
