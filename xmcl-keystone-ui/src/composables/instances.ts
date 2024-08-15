import { useEventBus, useLocalStorage } from '@vueuse/core'
import { EditInstanceOptions, Instance, InstanceSchema, InstanceServiceKey, InstanceState } from '@xmcl/runtime-api'
import { DeepPartial } from '@xmcl/runtime-api/src/util/object'
import { InjectionKey, set } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstances: InjectionKey<ReturnType<typeof useInstances>> = Symbol('Instances')

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { createInstance, getSharedInstancesState, editInstance, deleteInstance, validateInstancePath } = useService(InstanceServiceKey)
  const { state, isValidating, error } = useState(getSharedInstancesState, class extends InstanceState {
    override instanceAdd(instance: Instance) {
      if (!this.all[instance.path]) {
        const object = {
          ...instance,
        }
        this.all[instance.path] = object
        this.instances = [...this.instances, this.all[instance.path]]
      }
    }

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
  const instances = computed(() => state.value?.instances ?? [])
  const _path = useLocalStorage('selectedInstancePath', '' as string)
  const path = ref('')

  const migrationBus = useEventBus<{ oldRoot: string; newRoot: string }>('migration')

  migrationBus.once((e) => {
    _path.value = _path.value.replace(e.oldRoot, e.newRoot)
  })

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
  watch(state, async (newVal, oldVal) => {
    if (!newVal) return
    if (!oldVal) {
      // initialize
      const instances = [...newVal.instances]
      const lastSelectedPath = _path.value

      const selectDefault = async () => {
        // Select the first instance
        let defaultPath = instances[0]?.path as string | undefined
        if (!defaultPath) {
          // Create a default instance
          defaultPath = await createInstance({
            name: 'Minecraft',
          })
        }
        _path.value = defaultPath
      }

      if (lastSelectedPath) {
        // Validate the last selected path
        if (!instances.some(i => i.path === lastSelectedPath)) {
          const badInstance = await validateInstancePath(lastSelectedPath)
          if (badInstance) {
            await selectDefault()
          }
        }
      } else {
        // No selected, try to select the first instance
        await selectDefault()
      }

      path.value = _path.value
    }
  })
  watch(path, (newPath) => {
    if (newPath !== _path.value) {
      // save to local storage
      _path.value = newPath
    }
    editInstance({
      instancePath: newPath,
      lastAccessDate: Date.now(),
    })
  })

  const ready = computed(() => state.value !== undefined)
  return {
    selectedInstance: path,
    ready,
    instances,
    isValidating,
    error,
    edit,
    remove,
  }
}
