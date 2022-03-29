import { computed, InjectionKey, onMounted, onUnmounted, reactive, Ref, ref } from '@vue/composition-api'
import { TaskItem } from '/@/entities/task'
import { useI18n } from '../../composables'
import { TaskBatchUpdatePayloads, TaskPayload, TaskState } from '@xmcl/runtime-api'

export const TASK_MANAGER: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

class ChildrenWatcher {
  readonly oldChildren: Array<TaskItem> = []

  readonly newChildren: Array<TaskItem> = []

  readonly updateChildren: Array<TaskItem> = []

  readonly visited: Set<TaskItem> = new Set()

  public dirty = false

  constructor(private target: Ref<TaskItem[]>, init?: TaskItem[]) {
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
    this.target.value = result

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
  const { $t } = useI18n()
  const dictionary: Record<string, TaskItem> = {}
  const watchers: Record<string, ChildrenWatcher> = {}
  /**
   * All the root tasks
   */
  const tasks: Ref<TaskItem[]> = ref(reactive([]))

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

  function mapAndRecordTaskItem(payload: TaskPayload): TaskItem {
    const children = ref([])
    const watcher = new ChildrenWatcher(children, payload.children.map(mapAndRecordTaskItem))
    const localId = `${payload.uuid}@${payload.id}`
    watchers[localId] = watcher
    const item = reactive({
      id: localId,
      taskId: payload.uuid,
      title: computed(() => $t(payload.path, payload.param)),
      time: new Date(payload.time),
      message: payload.error ?? payload.from ?? payload.to ?? '',
      from: payload.from,
      to: payload.to,
      throughput: 0,
      state: payload.state,
      progress: payload.progress,
      total: payload.total,
      children,
    })
    dictionary[localId] = item
    return item
  }

  const taskUpdateHandler = async ({ adds, updates }: TaskBatchUpdatePayloads) => {
    if (syncing) {
      await syncing
    }
    for (const add of adds) {
      const { uuid, id, path, param, time, to, from, parentId } = add
      const localId = `${uuid}@${id}`
      const children = ref([] as TaskItem[])
      const watcher = new ChildrenWatcher(children)
      const item = reactive({
        taskId: uuid,
        id: localId,
        title: computed(() => $t(path, param)),
        children,
        time: new Date(time),
        message: from ?? to ?? '',
        from: from ?? '',
        to: to ?? '',
        throughput: 0,
        state: TaskState.Running,
        progress: 0,
        total: -1,
        parentId,
      })
      if (typeof parentId === 'number') {
        // leave
        const parentLocalId = `${uuid}@${parentId}`
        const parentWatcher = watchers[parentLocalId]
        parentWatcher.addChild(item)
      } else {
        tasks.value.unshift(item)
      }
      if (dictionary[localId]) {
        console.warn(`Skip for duplicated task ${localId} ${item.title}`)
        continue
      }
      watchers[localId] = watcher
      dictionary[localId] = item
    }
    for (const update of updates) {
      const { uuid, id, time, to, from, progress, total, chunkSize, state, error } = update
      const localId = `${uuid}@${id}`
      const item = dictionary[localId]
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
        item.message = error || from || to || item.message
        if (chunkSize) {
          item.throughput += chunkSize
        }
        if (item.parentId !== undefined) {
          const parentLocalId = `${uuid}@${item.parentId}`
          const parentWatcher = watchers[parentLocalId]
          parentWatcher.updateChild(item)
        }
      } else {
        console.log(`Cannot apply update for task ${localId} as task not found.`)
      }
    }
    Object.values(watchers).forEach((v) => v.update())
  }

  onMounted(() => {
    let _resolve: () => void
    syncing = new Promise((resolve) => { _resolve = resolve })
    taskMonitor.on('task-update', taskUpdateHandler)
    taskMonitor.subscribe().then((payload) => {
      tasks.value = payload.map(mapAndRecordTaskItem)
      _resolve()
    })
  })
  onUnmounted(() => {
    taskMonitor.unsubscribe()
    taskMonitor.removeListener('task-update', taskUpdateHandler)
  })

  return {
    dictionary,
    tasks,
    pause,
    resume,
    cancel,
  }
}
