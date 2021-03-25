import { TaskAddedPayload, TaskBatchPayload, TaskPayload, TaskUpdatePayload } from '/@shared/task'
import { Task, TaskGroup, TaskState } from '@xmcl/task'
import { EventEmitter } from 'events'

export type TaskEventType = 'update' | 'start' | 'success' | 'fail' | 'pause' | 'cancel' | 'resume'

export interface TaskEventEmitter extends EventEmitter {
  on(event: 'update', handler: (uuid: string, task: Task<any>, chunkSize: number) => void): this
  on(event: 'fail', handler: (uuid: string, task: Task<any>, error: any) => void): this
  on(event: TaskEventType, handler: (uuid: string, task: Task<any>) => void): this

  emit(event: 'update', uuid: string, task: Task<any>, chunkSize: number): boolean
  emit(event: 'fail', uuid: string, task: Task<any>, error: any): boolean
  emit(event: TaskEventType, uuid: string, task: Task<any>): boolean
}

export interface TaskMonitor {
  flush(): TaskBatchPayload
  destroy(): void
}

export function mapTaskToTaskPayload (uuid: string, task: Task<any>): TaskPayload {
  return {
    id: task.id,
    path: task.path,
    param: task.param,
    uuid,
    progress: task.progress,
    total: task.total,
    to: task.to ?? '',
    from: task.from ?? '',
    state: task.state,
    time: Date.now(),
    error: Reflect.get(task, 'error'),
    children: task instanceof TaskGroup ? (task as any).children.map((c: Task) => mapTaskToTaskPayload(uuid, c)) : [],
  }
}

/**
 * Create a monitor to a task runtime.
 */
export function createTaskMonitor (
  emitter: TaskEventEmitter,
  onEventQueued: (total: number) => void = () => { },
): TaskMonitor {
  let adds: TaskAddedPayload[] = []
  let updates: Record<string, TaskUpdatePayload> = {}

  function notify () {
    onEventQueued(adds.length + Object.keys(updates).length)
  }
  function getUpdate (uuid: string, task: Task<any>): TaskUpdatePayload {
    const uuidWithId = `${uuid}@${task.id}`
    if (uuidWithId in updates) {
      return updates[uuidWithId]
    }
    const update = {
      uuid, id: task.id, time: Date.now(),
    }
    updates[uuidWithId] = update
    return update
  }

  function status (uuid: string, task: Task<any>) {
    const partial = getUpdate(uuid, task)
    partial.state = task.state
    notify()
  }
  function fail (uuid: string, task: Task<any>, error: any) {
    const partial = getUpdate(uuid, task)
    let errorMessage: string
    if (error instanceof Error) {
      errorMessage = error.toString()
    } else {
      errorMessage = JSON.stringify(error, null, 4)
    }
    partial.error = errorMessage
    partial.state = task.state
    notify()
  }
  function update (uuid: string, task: Task<any>, size?: number) {
    const partial = getUpdate(uuid, task)
    partial.progress = task.progress
    partial.total = task.total
    partial.from = task.from
    partial.to = task.to
    if (typeof size === 'number') {
      if (partial.chunkSize) {
        partial.chunkSize += size
      } else {
        partial.chunkSize = size
      }
    }
    notify()
  }
  function start (uuid: string, task: Task) {
    adds.push({
      from: task.from,
      to: task.to,
      uuid,
      id: task.id,
      parentId: task.parent?.id,
      path: task.path,
      param: task.param,
      time: Date.now(),
    })
    notify()
  }

  emitter.on('start', start)
  emitter.on('update', update)
  emitter.on('pause', status)
  emitter.on('resume', status)
  emitter.on('success', status)
  emitter.on('cancel', status)
  emitter.on('fail', fail)

  function flush (): TaskBatchPayload {
    const result: TaskBatchPayload = {
      adds,
      updates: Object.values(updates),
    }

    adds = []
    updates = {}

    return result
  }
  function destroy () {
    emitter.removeListener('start', start)
    emitter.removeListener('update', update)
    emitter.removeListener('pause', status)
    emitter.removeListener('resume', status)
    emitter.removeListener('finish', status)
    emitter.removeListener('cancel', status)
    emitter.removeListener('fail', fail)
  }

  return { flush, destroy }
}

/**
 * Create a task state pusher. It will push the task payload to the client for a fixed interval,
 * or the task payload size is greater than threshold.
 * @param emitter The task runtime to monitor
 * @param interval The interval to push the task update
 * @param threshold The threshold of the task payload to be pushed
 * @param consume The actual push implementation
 * @returns The destroy function of this push. You can destroy the pusher by calling it.
 */
export function createTaskPusher (
  emitter: TaskEventEmitter,
  interval: number,
  threshold: number,
  consume: (payload: TaskBatchPayload) => void,
) {
  const monitor = createTaskMonitor(emitter, (size) => {
    if (size > threshold) {
      consume(monitor.flush())
    }
  })
  const flush = () => {
    const result = monitor.flush()
    if (result.adds.length > 0 || result.updates.length > 0) {
      consume(result)
    }
  }
  const handle = setInterval(flush, interval)
  return () => {
    monitor.destroy()
    clearInterval(handle)
  }
}
