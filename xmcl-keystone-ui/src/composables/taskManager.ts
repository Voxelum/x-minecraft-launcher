import { computed, InjectionKey, onMounted, onUnmounted, reactive, Ref, ref } from 'vue'
import { TaskItem } from '@/entities/task'

import { TaskAddedPayload, TaskBatchUpdatePayloads, TaskPayload, TaskState } from '@xmcl/runtime-api'

export const kTaskManager: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

class ChildrenWatcher {
  readonly oldChildren: Array<TaskItem> = []

  readonly newChildren: Array<TaskItem> = []

  readonly updateChildren: Array<TaskItem> = []

  readonly visited: Set<TaskItem> = new Set()

  public dirty = false

  constructor(private target: TaskItem, init?: TaskItem[]) {
    if (init) {
      this.newChildren = init
      this.dirty = true
      this.update()
    }
  }

  addChild(item: TaskItem) {
    this.newChildren.unshift(item)
    this.dirty = true
  }

  updateChild(item: TaskItem) {
    this.updateChildren.push(item)
    this.dirty = true
  }

  update() {
    if (!this.dirty) {
      return
    }
    const inactive = []
    const active = []
    const newChildren = this.newChildren
    const updatedChildren = this.updateChildren
    const oldChildren = this.oldChildren
    const visited = this.visited

    for (const item of newChildren) {
      if (item.state === TaskState.Succeed) {
        inactive.push(item)
      } else {
        active.push(item)
      }
      visited.add(item)
    }
    for (const item of updatedChildren) {
      if (item.state === TaskState.Succeed) {
        inactive.push(item)
      } else {
        active.push(item)
      }
      visited.add(item)
    }
    for (const item of oldChildren) {
      if (visited.has(item)) continue
      if (item.state === TaskState.Succeed) {
        inactive.push(item)
      } else {
        active.push(item)
      }
      visited.add(item)
    }
    const sorted = active.concat(inactive)

    // only show 10
    const result = sorted.slice(0, 10)
    this.target.children = result

    updatedChildren.splice(0)
    newChildren.splice(0)
    oldChildren.splice(0)
    oldChildren.push(...sorted)
    visited.clear()
  }
}

/**
 * Create a task manager based on vue reactivity
 * @returns
 */
export function useTaskManager() {
  const cache: Record<string, TaskItem> = {}
  const throughput = ref(0)
  /**
   * All tasks
   */
  const tasks: Ref<TaskItem[]> = ref([])

  const pause = (task: TaskItem) => {
    taskMonitor.pause(task.taskId)
  }
  const resume = (task: TaskItem) => {
    taskMonitor.resume(task.taskId)
  }
  const cancel = (task: TaskItem) => {
    taskMonitor.cancel(task.taskId)
  }

  let syncing: Promise<void> | undefined

  function getTaskItem(payload: TaskPayload | TaskAddedPayload): TaskItem {
    const id = `${payload.uuid}@${payload.id}`
    // console.log(`Add task ${payload.path}(${id})`)
    const item: TaskItem = {
      id,
      taskId: payload.uuid,
      time: new Date(payload.time),
      message: 'error' in payload && payload.error ? markRaw(payload.error) : payload.from ?? payload.to ?? '',
      from: payload.from ?? '',
      path: payload.path,
      param: payload.param,
      to: payload.to ?? '',
      throughput: 0,
      rawChildren: markRaw([]),
      childrenDirty: false,
      state: 'state' in payload ? payload.state : TaskState.Running,
      progress: 'progress' in payload ? payload.progress : 0,
      total: 'total' in payload ? payload.total : -1,
      children: [],
    }
    if ('parentId' in payload) {
      item.parentId = payload.parentId
    }
    return item
  }

  const onTaskUpdate = async ({ adds, updates }: TaskBatchUpdatePayloads) => {
    if (syncing) {
      await syncing
    }
    for (const add of adds) {
      const { uuid, parentId, path, id: _id } = add
      const id = `${uuid}@${_id}`
      if (cache[id]) {
        console.warn(`Skip for duplicated task ${id} ${path}`)
        continue
      }
      const item = getTaskItem(add)
      if (typeof parentId === 'number') {
        // this is child task
        const parent = cache[`${uuid}@${parentId}`]
        // Push to the static children and mark dirty
        // We don't update the reactive children
        // Until the consumer (task-viewer) need to render the children
        parent.rawChildren?.push(item)
        parent.childrenDirty = true
      } else {
        tasks.value.unshift(item)
      }
      cache[id] = item
      // console.log(`Add task ${add.path}(${id})`)
    }
    for (const update of updates) {
      const { uuid, id, time, to, from, progress, total, chunkSize, state, error } = update
      const localId = `${uuid}@${id}`
      const item = cache[localId]
      if (item) {
        if (state !== undefined) {
          item.state = state
        }
        if (progress !== undefined) {
          item.progress = progress
        }
        if (total !== undefined) {
          item.total = total
        }
        item.time = new Date(time)
        item.message = Object.freeze(error) || item.message
        if (chunkSize) {
          item.throughput += chunkSize
          throughput.value += chunkSize
        }
      } else {
        console.log(`Cannot apply update for task ${localId} as task not found.`)
        console.log(cache)
      }
    }
  }

  onMounted(() => {
    let _resolve: () => void
    syncing = new Promise((resolve) => { _resolve = resolve })
    taskMonitor.on('task-update', onTaskUpdate)
    taskMonitor.subscribe().then((payload) => {
      const result = payload.map(getTaskItem)
      tasks.value = result
      for (const r of result) {
        cache[r.id] = r
      }
      _resolve()
    })
  })
  onUnmounted(() => {
    taskMonitor.unsubscribe()
    taskMonitor.removeListener('task-update', onTaskUpdate)
  })

  return {
    dictionary: cache,
    throughput,
    tasks,
    pause,
    resume,
    cancel,
  }
}
