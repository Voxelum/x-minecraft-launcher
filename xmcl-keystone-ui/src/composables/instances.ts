import { EditInstanceOptions, InstanceSchema, InstanceServiceKey, InstanceState } from '@xmcl/runtime-api'
import { InjectionKey, Ref, set } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'
import { DeepPartial } from '@xmcl/runtime-api/src/util/object'
import { useSortedInstance } from './instanceSort'
import { useLocalStorageCacheStringValue } from './cache'

export const kInstances: InjectionKey<ReturnType<typeof useInstances>> = Symbol('Instances')

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const path = useLocalStorageCacheStringValue('selectedInstancePath', '' as string)
  const { createInstance, getSharedInstancesState, editInstance, deleteInstance } = useService(InstanceServiceKey)
  const { state, isValidating, error } = useState(getSharedInstancesState, class extends InstanceState {
    override instanceEdit(settings: DeepPartial<InstanceSchema> & { path: string }) {
      const inst = this.instances.find(i => i.path === (settings.path))!
      if ('showLog' in settings) {
        set(inst, 'showLog', settings.showLog)
      }
      if ('hideLauncher' in settings) {
        set(inst, 'hideLauncher', settings.hideLauncher)
      }
      if ('fastLaunch' in settings) {
        set(inst, 'fastLaunch', settings.fastLaunch)
      }
      if ('maxMemory' in settings) {
        set(inst, 'maxMemory', settings.maxMemory)
      }
      if ('minMemory' in settings) {
        set(inst, 'minMemory', settings.minMemory)
      }
      if ('assignMemory' in settings) {
        set(inst, 'assignMemory', settings.assignMemory)
      }
      if ('vmOptions' in settings) {
        set(inst, 'vmOptions', settings.vmOptions)
      }
      if ('mcOptions' in settings) {
        set(inst, 'mcOptions', settings.mcOptions)
      }
      super.instanceEdit(settings)
    }
  })
  const _instances = computed(() => state.value?.instances ?? [])
  const { instances, setToPrevious } = useSortedInstance(_instances)

  async function edit(options: EditInstanceOptions & { instancePath: string }) {
    await editInstance(options)
  }
  async function remove(instancePath: string) {
    const index = instances.value.findIndex(i => i.path === instancePath)
    const lastSelected = path.value
    await deleteInstance(instancePath)
    if (instancePath === lastSelected) {
      path.value = instances.value[Math.max(index - 1, 0)]?.path ?? ''
      if (!path.value) {
        createInstance({
          name: 'Minecraft',
        }).then(p => {
          path.value = p
        })
      }
    }
  }
  watch(state, async (newState) => {
    let firstInstancePath = instances.value[0]?.path ?? ''
    if (!firstInstancePath) {
      firstInstancePath = await createInstance({
        name: 'Minecraft',
      })
      path.value = ''
    }
    if (!path.value) {
      // Select the first instance
      path.value = firstInstancePath
    }
  })
  return {
    selectedInstance: path,
    instances,
    setToPrevious,
    isValidating,
    error,
    edit,
    remove,
  }
}
