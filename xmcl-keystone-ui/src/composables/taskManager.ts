import { TaskItem } from '@/entities/task'
import { InjectionKey, onMounted, onUnmounted, Ref, ref } from 'vue'

import { TaskAddedPayload, TaskBatchUpdatePayloads, TaskPayload, TaskState } from '@xmcl/runtime-api'

export const kTaskManager: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

/**
 * Create a task manager based on vue reactivity
 * @returns
 */
export function useTaskManager() {
  const cache: Record<string, WeakRef<TaskItem> | undefined> = {}

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
      path: payload.path,
      param: payload.param,
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
      if (cache[id]?.deref()) {
        console.warn(`Skip for duplicated task ${id} ${path}`)
        continue
      }
      const item = getTaskItem(add)
      if (typeof parentId === 'number') {
        // this is child task
        const parent = cache[`${uuid}@${parentId}`]?.deref()
        // Push to the static children and mark dirty
        // We don't update the reactive children
        // Until the consumer (task-viewer) need to render the children
        parent?.rawChildren?.push(item)
        if (parent) {
          parent.childrenDirty = true
        }
      } else {
        tasks.value.unshift(item)
      }
      cache[id] = new WeakRef(item)
    }
    for (const update of updates) {
      const { uuid, id, time, to, from, progress, total, chunkSize, state, error } = update
      const localId = `${uuid}@${id}`
      const item = cache[localId]?.deref()
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
        item.message = Object.freeze(error) || from || to || item.message
        if (chunkSize) {
          item.throughput += chunkSize
          throughput.value += chunkSize
        }
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
        cache[r.id] = new WeakRef(r)
      }
      _resolve()
    })
  })
  onUnmounted(() => {
    taskMonitor.unsubscribe()
    taskMonitor.removeListener('task-update', onTaskUpdate)
  })

  function clear() {
    tasks.value = tasks.value.filter(t => t.state !== TaskState.Cancelled && t.state !== TaskState.Succeed)
  }

  return {
    dictionary: cache,
    throughput,
    clear,
    tasks,
    pause,
    resume,
    cancel,
  }
}
