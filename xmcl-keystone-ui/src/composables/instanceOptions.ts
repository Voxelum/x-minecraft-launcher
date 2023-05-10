import { Instance, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export function useInstanceOptions(instance: Ref<Instance>) {
  const { watchOptions } = useService(InstanceOptionsServiceKey)
  return useState(computed(() => instance.value.path), () => watchOptions(instance.value.path))
}
