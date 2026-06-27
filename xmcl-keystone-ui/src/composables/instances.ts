import { useEventBus, useLocalStorage } from '@vueuse/core'
import type { EditInstanceOptions, Instance, InstanceDataWithTime } from '@xmcl/instance'
import { InstanceServiceKey, InstanceState, AUTHORITY_DEV, AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'
import { InjectionKey, inject } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'
import { InstanceOrGroupData } from './instanceGroup'
import { kUserContext } from './user'

export const kInstances: InjectionKey<ReturnType<typeof useInstances>> = Symbol('Instances')

/**
 * Hook of a view of all instances & some deletion/selection functions
 */
export function useInstances() {
  const { createInstance, getSharedInstancesState, editInstance, deleteInstance, validateInstancePath } = useService(InstanceServiceKey)
  const { state, isValidating, error } = useState(getSharedInstancesState, class extends InstanceState {
    constructor() {
      super()
      this.all = markRaw({})
      this.instances = markRaw([])
    }

    override instanceRemove(path: string): void {
      delete this.all[path]
      this.instances = markRaw(this.instances.filter(i => i.path !== path))
    }

    override instanceAdd(instance: Instance) {
      if (!this.all[instance.path]) {
        const object = markRaw({
          ...instance,
        })
        this.all[instance.path] = object
        this.instances = markRaw([...this.instances, this.all[instance.path]])
      }
    }

    override instanceEdit(settings: Partial<InstanceDataWithTime> & { path: string }) {
      const inst = this.instances.find(i => i.path === (settings.path))
      if (!inst) return

      // Apply the same JIT mutations the renderer used to do in-place, but
      // produce a brand-new instance object reference instead. The previous
      // implementation mutated a `markRaw`-wrapped object, which Vue cannot
      // observe — downstream `watch(... { deep: true })` consumers therefore
      // never re-evaluated after `editInstance`, leaving stale state in the UI.
      const next = markRaw({ ...inst })
      if ('showLog' in settings) next.showLog = settings.showLog
      if ('hideLauncher' in settings) next.hideLauncher = settings.hideLauncher
      if ('fastLaunch' in settings) next.fastLaunch = settings.fastLaunch
      if ('maxMemory' in settings) next.maxMemory = settings.maxMemory
      if ('minMemory' in settings) next.minMemory = settings.minMemory
      if ('assignMemory' in settings) next.assignMemory = settings.assignMemory
      if ('vmOptions' in settings) next.vmOptions = settings.vmOptions
      if ('mcOptions' in settings) next.mcOptions = settings.mcOptions
      if ('preExecuteCommand' in settings) next.preExecuteCommand = settings.preExecuteCommand

      // Let the shared base apply the rest of the diff (runtime, icon, etc.)
      // onto the new object so all downstream fields stay in sync.
      const previousInstances = this.instances
      this.instances = [next]
      try {
        super.instanceEdit(settings)
      } finally {
        this.instances = previousInstances
      }

      this.all[next.path] = next
      const idx = this.instances.indexOf(inst)
      this.instances = markRaw([
        ...this.instances.slice(0, idx),
        next,
        ...this.instances.slice(idx + 1),
      ])
    }
  })
  const userContext = inject(kUserContext)
  const userProfile = userContext?.userProfile

  const instances = computed(() => {
    const list = state.value?.instances ?? []
    const isOffline = userProfile?.value?.authority && userProfile?.value?.authority !== AUTHORITY_MICROSOFT
    if (isOffline) {
      return list.filter(i => i.edition !== 'bedrock')
    }
    return list
  })

  const allInstances = computed(() => state.value?.instances ?? [])

  const _path = useLocalStorage('selectedInstancePath', '' as string)
  const path = ref('')

  const migrationBus = useEventBus<{ oldRoot: string; newRoot: string }>('migration')

  migrationBus.once((e) => {
    _path.value = _path.value.replace(e.oldRoot, e.newRoot)
  })

  async function edit(options: EditInstanceOptions & { instancePath: string }) {
    await editInstance({
      ...options,
      env: {
        ...(options.env ? JSON.parse(JSON.stringify(options.env)) : undefined),
      },
      // Keep `null` (the IPC-safe "reset to global" marker) intact instead of
      // collapsing it back to `undefined` — Electron IPC would drop the latter
      // and the resolution override would never be removed from instance.json.
      resolution: options.resolution ? JSON.parse(JSON.stringify(options.resolution)) : options.resolution,
    })
  }
  async function remove(instancePath: string, deleteData = true) {
    const index = instances.value.findIndex(i => i.path === instancePath)
    const lastSelected = path.value
    await deleteInstance(instancePath, deleteData)
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
      const lastSelectedPath = _path.value

      const selectDefault = async () => {
        // Select the first instance
        let defaultPath = instances.value[0]?.path as string | undefined
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
        if (!instances.value.some(i => i.path === lastSelectedPath)) {
          await selectDefault()
        } else {
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

  watch(instances, (newInstances) => {
    if (ready.value && !newInstances.some(i => i.path === path.value)) {
      if (newInstances.length > 0) {
        path.value = newInstances[0].path
      } else {
        createInstance({
          name: 'Minecraft',
        }).then(p => {
          path.value = p
        })
      }
    }
  })

  const ready = computed(() => state.value !== undefined)
  const groups = computed(() => {
    const rawGroups = state.value?.groups ?? []
    const isOffline = userProfile?.value?.authority && userProfile?.value?.authority !== AUTHORITY_MICROSOFT
    if (isOffline && state.value) {
      const all = state.value.all
      return rawGroups.map(item => {
        if (typeof item === 'string') {
          const inst = all[item]
          if (inst && inst.edition === 'bedrock') {
            return null
          }
          return item
        } else {
          const filtered = item.instances.filter(instPath => {
            const inst = all[instPath]
            return !(inst && inst.edition === 'bedrock')
          })
          if (filtered.length === 0) return null
          return { ...item, instances: filtered }
        }
      }).filter((v): v is InstanceOrGroupData => v !== null)
    }
    return rawGroups
  })
  const groupsSet = (groups: InstanceOrGroupData[]) => {
    state.value?.instanceGroupsSet(groups)
  }
  return {
    selectedInstance: path,
    groups,
    groupsSet,
    ready,
    instances,
    allInstances,
    isValidating,
    error,
    edit,
    remove,
  }
}
