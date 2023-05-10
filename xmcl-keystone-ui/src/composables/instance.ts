import { useSemaphore, useServiceBusy } from '@/composables/semaphore'
import { useService } from '@/composables/service'
import { Frame as GameSetting } from '@xmcl/gamesetting'
import { DEFAULT_PROFILE, EMPTY_VERSION, Instance, InstanceData, InstanceOptionsServiceKey, InstanceServiceKey, InstanceVersionServiceKey } from '@xmcl/runtime-api'
import { computed, Ref } from 'vue'

export function useInstanceBase() {
  const { state } = useService(InstanceServiceKey)
  const path = computed(() => state.path)
  return { path }
}

export function useInstanceIsServer(i: Ref<Instance>) {
  return computed(() => i.value.server !== null)
}

/**
 * Use the general info of the instance
 */
export function useInstance() {
  const { state } = useService(InstanceServiceKey)

  const instance = computed(() => state.instances.find(i => i.path === state.path) ?? DEFAULT_PROFILE)
  const path = computed(() => state.path)
  return {
    path,
    instance,
    refreshing: computed(() => useSemaphore('instance').value !== 0),
  }
}

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { state } = useService(InstanceServiceKey)
  return {
    instances: computed(() => state.instances),
  }
}

export function useInstanceServerEdit(server: Ref<InstanceData['server']>) {
  const result = computed({
    get: () => server.value ?? { host: '', port: undefined },
    set: (v) => { server.value = v },
  })
  return result
}
