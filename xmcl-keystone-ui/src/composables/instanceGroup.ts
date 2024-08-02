import { useLocalStorage } from '@vueuse/core'
import { Instance } from '@xmcl/runtime-api'

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

export function useGroupDragDropState(emit: (event: 'arrange' | 'group' | 'drop-save', data: any) => void) {
  const dragging = ref(false)
  const dragover = ref(0)
  const overState = ref(undefined as OverState | undefined)
  const getOverState = (e: DragEvent) => {
    // determine if this is drag on top 1/4 or bottom 1/4 of the target
    let state = undefined as OverState | undefined
    const rect = (e.target as HTMLElement).getBoundingClientRect()

    const y = e.clientY - rect.top
    const height = rect.height
    if (y < height / 4) {
      state = OverState.TopQuad
    } else if (y > (height / 4 * 3)) {
      state = OverState.BottomQuad
    } else {
      state = OverState.Middle
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
    overState.value = getOverState(e)
  }

  const onDragLeave = () => {
    dragover.value += -1
    if (dragover.value < 0) {
      dragover.value = 0
      overState.value = undefined
    }
  }

  const onDrop = (e: DragEvent) => {
    const targetPath = e.dataTransfer!.getData('instance')
    const savePath = e.dataTransfer?.getData('save')
    const topHalf = getOverState(e)
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

export function useInstanceGroup(instances: Ref<Instance[]>) {
  const groupsData = useLocalStorage('instanceGroup', () => [] as InstanceOrGroupData[], {
  })

  const lookup = computed(() => {
    const record = {} as Record<string, Instance>
    for (const i of instances.value) {
      record[i.path] = i
    }
    return record
  })

  watch(instances, (instances) => {
    const groups = groupsData.value
    const newGroupData = [...groups] as InstanceOrGroupData[]
    for (const i of instances) {
      if (!groups.some(v => typeof v === 'string' ? v === i.path : v.instances.includes(i.path))) {
        newGroupData.push(i.path)
      }
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
    const newGroups = [] as InstanceOrGroupData[]

    for (const cur of data) {
      if (typeof cur === 'string') {
        if (isEqualGroup(cur, to)) {
          newGroups.push({ id: crypto.getRandomValues(new Uint32Array(2))[0].toString(16), name: '', color: '#000000', instances: [cur, from] })
        } else if (isEqualGroup(cur, from)) {
          // do nothing
        } else {
          newGroups.push(cur)
        }
      } else {
        if (isEqualGroup(cur, to)) {
          cur.instances.push(from)
          newGroups.push(cur)
        } else {
          for (let i = 0; i < cur.instances.length; i++) {
            if (cur.instances[i] === from) {
              cur.instances.splice(i, 1)
              break
            }
          }
        }
      }
    }

    groupsData.value = newGroups
  }

  const move = (from: InstanceOrGroupData, to: InstanceOrGroupData, previous?: boolean) => {
    // move a group or a instance around
    const data = groupsData.value
    const targetIndex = data.findIndex(v => isEqualGroup(v, to))
    const newOrders = [] as InstanceOrGroupData[]
    for (let i = 0; i < data.length; i++) {
      const current = data[i]
      if (previous) {
        if (i === targetIndex) {
          newOrders.push(from)
        }
      }
      if (!isEqualGroup(current, from)) {
        newOrders.push(current)
      }
      if (!previous) {
        if (i === targetIndex) {
          newOrders.push(from)
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
