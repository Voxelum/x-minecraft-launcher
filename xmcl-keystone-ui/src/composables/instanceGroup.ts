import { injection } from '@/util/inject'
import { get, MaybeRef, useEventBus, useLocalStorage } from '@vueuse/core'
import { kInstances } from './instances'
import { kTheme } from './theme'

export interface InstanceGroupData {
  color: string
  name: string
  id: string
  instances: string[]
}

export enum OverState {
  TopQuad, // top 1/4
  Middle, // middle 1/2
  BottomQuad, // bottom 1/4
}

export type InstanceOrGroupData = string | InstanceGroupData

export function useGroupDragDropState(emit: (event: 'arrange' | 'group' | 'drop-save', data: any) => void, inside?: MaybeRef<boolean | undefined>) {
  const dragging = ref(false)
  const dragover = ref(0)
  const overState = ref(undefined as OverState | undefined)
  const getOverState = (e: DragEvent, half = get(inside)) => {
    // determine if this is drag on top 1/4 or bottom 1/4 of the target
    let state = undefined as OverState | undefined
    const rect = (e.target as HTMLElement).getBoundingClientRect()

    const y = e.clientY - rect.top
    const height = rect.height
    if (half) {
      if (y < height / 2) {
        state = OverState.TopQuad
      } else {
        state = OverState.BottomQuad
      }
    } else {
      if (y < (height / 5 * 2)) {
        state = OverState.TopQuad
      } else if (y > (height / 5 * 4)) {
        state = OverState.BottomQuad
      } else {
        state = OverState.Middle
      }
    }

    return state
  }

  const onDragEnd = (e: DragEvent) => {
    dragging.value = false
    overState.value = undefined
  }

  const onDragEnter = (e: DragEvent) => {
    if (e.dataTransfer?.items[0].type === 'instance') {
      dragover.value += 1
    }
  }

  const onDragOver = (e: DragEvent) => {
    const hasGroup = e.dataTransfer?.items[1]?.type === 'group' || e.dataTransfer?.items[0]?.type === 'group'
    overState.value = getOverState(e, !!hasGroup || dragging.value)
  }

  const onDragLeave = () => {
    dragover.value += -1
    if (dragover.value <= 0) {
      dragover.value = 0
      overState.value = undefined
    }
  }

  const onDrop = (e: DragEvent) => {
    let targetPath = e.dataTransfer!.getData('instance')
    const groupPath = e.dataTransfer?.getData('group')
    if (groupPath) {
      targetPath = JSON.parse(groupPath)
    }
    const savePath = e.dataTransfer?.getData('save')
    const topHalf = overState.value
    if (targetPath) {
      if (topHalf === OverState.TopQuad) {
        emit('arrange', { targetPath, previous: true })
      } else if (topHalf === OverState.BottomQuad) {
        emit('arrange', { targetPath, previous: false })
      } else {
        emit('group', targetPath)
      }
    } else if (savePath) {
      // emit('drop-save', props.instance.path, savePath)
    }
    dragging.value = false
    dragover.value = 0
    overState.value = undefined
  }
  return {
    onDragEnd,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    dragging,
    dragover,
    overState,
  }
}

export function useInstanceGroupDefaultColor() {
  const { isDark } = injection(kTheme)
  return computed(() => {
    const defaultColor = isDark.value ? '#3e3e3e66' : '#bcbcbc66'
    return defaultColor
  })
}

export function useInstanceGroup() {
  const { instances, ready } = injection(kInstances)
  const groupsData = useLocalStorage('instanceGroup', () => [] as InstanceOrGroupData[])

  const migrationBus = useEventBus<{ oldRoot: string; newRoot: string }>('migration')

  migrationBus.once((e) => {
    groupsData.value = groupsData.value.map((v) => {
      if (typeof v === 'string') {
        return v.replace(e.oldRoot, e.newRoot)
      }
      return { ...v, instances: v.instances.map(v => v.replace(e.oldRoot, e.newRoot)) }
    })
  })

  watch(instances, (instances) => {
    if (!ready.value) { return }
    const groups = groupsData.value
    const newGroupData = [] as InstanceOrGroupData[]
    const existed = new Set<string>(instances.map(v => v.path))
    for (const item of groups) {
      if (typeof item === 'string') {
        if (existed.has(item)) {
          newGroupData.push(item)
          existed.delete(item)
        }
      } else {
        const newInstances = [] as string[]
        for (const inst of item.instances) {
          if (existed.has(inst)) {
            newInstances.push(inst)
            existed.delete(inst)
          }
        }
        if (newInstances.length > 0) {
          newGroupData.push({ ...item, instances: newInstances })
        }
      }
    }
    for (const i of existed) {
      newGroupData.push(i)
    }

    groupsData.value = newGroupData
  }, { immediate: true })

  const isEqualGroup = (a: InstanceOrGroupData, b: InstanceOrGroupData) => {
    if (typeof a === 'string') {
      return typeof b === 'string' && a === b
    }
    return typeof b !== 'string' && a.id === b.id
  }

  const group = (from: string, to: InstanceOrGroupData) => {
    if (isEqualGroup(from, to)) return
    // make from and to to be group
    // the previous from should be removed
    // the previous to should be the new group with the union of from and to
    const data = groupsData.value
    const newOrders = [] as InstanceOrGroupData[]

    for (let i = 0; i < data.length; i++) {
      const current = data[i]
      if (typeof current === 'string') {
        if (isEqualGroup(current, to)) {
          newOrders.push({ id: crypto.getRandomValues(new Uint32Array(2))[0].toString(16), name: '', color: '', instances: [current, from] })
        } else if (!isEqualGroup(current, from)) {
          newOrders.push(current)
        }
      } else {
        const newInstances = [] as string[]
        for (const cur of current.instances) {
          if (!isEqualGroup(cur, from)) {
            newInstances.push(cur)
          }
        }
        current.instances = newInstances

        if (isEqualGroup(current, to)) {
          current.instances.push(from)
        }

        if (current.instances.length > 0) {
          newOrders.push(current)
        }
      }
    }

    groupsData.value = newOrders
  }

  const move = (from: InstanceOrGroupData, to: InstanceOrGroupData, previous?: boolean) => {
    if (isEqualGroup(from, to)) return
    // move a group or a instance around
    const data = groupsData.value
    const pivot = typeof to === 'string' ? to : to.id
    const newOrders = [] as InstanceOrGroupData[]

    for (let i = 0; i < data.length; i++) {
      const current = data[i]
      if (typeof current === 'string') {
        // move a group or inst to another inst
        if (previous) {
          if (current === pivot) {
            newOrders.push(from)
          }
        }
        if (!isEqualGroup(current, from)) {
          newOrders.push(current)
        }
        if (!previous) {
          if (current === pivot) {
            newOrders.push(from)
          }
        }
      } else {
        if (typeof from === 'string') {
          const newInstances = [] as string[]
          for (let j = 0; j < current.instances.length; j++) {
            const cur = current.instances[j]
            if (cur === pivot) {
              if (previous) {
                newInstances.push(from)
              }
            }
            if (cur !== from) {
              newInstances.push(cur)
            }
            if (!previous) {
              if (cur === pivot) {
                newInstances.push(from)
              }
            }
          }
          current.instances = newInstances
        }

        if (previous) {
          if (current.id === pivot) {
            newOrders.push(from)
          }
        }
        if (!isEqualGroup(current, from) && current.instances.length > 0) {
          newOrders.push(current)
        }
        if (!previous) {
          if (current.id === pivot) {
            newOrders.push(from)
          }
        }
      }
    }

    groupsData.value = newOrders
  }

  return {
    groups: groupsData,
    move,
    group,
  }
}
