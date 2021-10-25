import { InjectionKey, onMounted, onUnmounted, reactive, Ref, ref } from '@vue/composition-api'
import { TaskItem } from '/@/entities/task'
import { useI18n } from '/@/hooks'
import { TaskBatchUpdatePayloads, TaskPayload, TaskState } from '/@shared/task'

export const TASK_MANAGER: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

class ChildrenWatcer {
  readonly cached: Array<TaskItem> = new Array(10)

  readonly childrens: Array<TaskItem> = []

  public dirty = false

  constructor(private target: Ref<TaskItem[]>, init?: TaskItem[]) {
    if (init) {
      this.childrens = init
      this.dirty = true
      this.update()
    }
  }

  addChild(item: TaskItem) {
    this.childrens.unshift(item)
    this.dirty = true
  }

  update() {
    if (!this.dirty) {
      return
    }
    const successed = []
    const others = []
    const children = this.childrens
    const cached = this.cached

    for (const item of children) {
      if (item.state === TaskState.Successed) {
        successed.push(item)
      } else {
        others.push(item)
      }
    }
    const combined = others.concat(successed)
    for (let i = 0; i < this.cached.length; i++) {
      const elem = combined.shift()
      if (elem) {
        cached[i] = elem
      } else {
        cached.length = i
        break
      }
    }
    this.target.value = cached
  }
}

/**
 * Create a task manager based on vue reactivity
 * @returns 
 */
export function useTaskManager() {
  const { $t } = useI18n()
  const dictionary: Record<string, TaskItem> = {}
  const watchers: Record<string, ChildrenWatcer> = {}
  /**
   * All the root tasks
   */
  const tasks: Ref<TaskItem[]> = ref(reactive([]))

  const pause = (task: TaskItem) => {
    taskChannel.pause(task.taskId)
  }
  const resume = (task: TaskItem) => {
    taskChannel.resume(task.taskId)
  }
  const cancel = (task: TaskItem) => {
    taskChannel.cancel(task.taskId)
  }

  let syncing: Promise<void> | undefined

  function mapAndRecordTaskItem(payload: TaskPayload): TaskItem {
    const children = ref([])
    const watcher = new ChildrenWatcer(children, payload.children.map(mapAndRecordTaskItem))
    const localId = `${payload.uuid}@${payload.id}`
    watchers[localId] = watcher
    const item = reactive({
      id: localId,
      taskId: payload.uuid,
      title: $t(payload.path, payload.param),
      time: new Date(payload.time),
      message: payload.error ?? payload.from ?? payload.to ?? '',
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
      const watcher = new ChildrenWatcer(children)
      const item = reactive({
        taskId: uuid,
        id: localId,
        title: $t(path, param),
        children,
        time: new Date(time),
        message: from ?? to ?? '',
        throughput: 0,
        state: TaskState.Running,
        progress: 0,
        total: -1,
        parentId,
      })
      if (typeof parentId === 'number') {
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
      } else {
        console.log(`Cannot apply update for task ${localId} as task not found.`)
      }
    }
    Object.values(watchers).forEach((v) => v.update())
  }

  onMounted(() => {
    let _resolve: () => void
    syncing = new Promise((resolve) => { _resolve = resolve })
    taskChannel.on('task-update', taskUpdateHandler)
    taskChannel.subscribe().then((payload) => {
      tasks.value = payload.map(mapAndRecordTaskItem)
      _resolve()
    })
  })
  onUnmounted(() => {
    taskChannel.unsubscribe()
    taskChannel.removeListener('task-update', taskUpdateHandler)
  })

  return {
    dictionary,
    tasks,
    pause,
    resume,
    cancel,
  }
}
