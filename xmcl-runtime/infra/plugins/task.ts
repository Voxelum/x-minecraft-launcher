import { TaskAddedPayload, TaskBatchUpdatePayloads, TaskPayload, TaskUpdatePayload } from '@xmcl/runtime-api'
import { CancelledError, Task, TaskContext, TaskGroup } from '@xmcl/task'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { Client, LauncherAppPlugin } from '~/app'
import { getNormalizeException, getSerializedError } from '../errors'
import { Logger } from '../logger'
import { TaskEventEmitter, kTaskExecutor, kTasks } from '../task'

function mapTaskToTaskPayload(uuid: string, task: Task<any>): TaskPayload {
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
function createTaskMonitor(
  emitter: TaskEventEmitter,
  onEventQueued: (total: number) => void = () => { },
) {
  let adds: TaskAddedPayload[] = []
  let updates: Record<string, TaskUpdatePayload> = {}

  function notify() {
    onEventQueued(adds.length + Object.keys(updates).length)
  }
  function getUpdate(uuid: string, task: Task<any>): TaskUpdatePayload {
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

  function status(uuid: string, task: Task<any>) {
    const partial = getUpdate(uuid, task)
    partial.state = task.state
    notify()
  }
  function fail(uuid: string, task: Task<any>, error: any) {
    const partial = getUpdate(uuid, task)
    partial.error = error
    partial.state = task.state
    notify()
  }
  function update(uuid: string, task: Task<any>, size?: number) {
    const partial = getUpdate(uuid, task)
    partial.progress = Number(task.progress)
    partial.total = Number(task.total)
    if (typeof task.from === 'string') { partial.from = task.from }
    if (typeof task.to === 'string') partial.to = task.to
    if (typeof size === 'number') {
      if (partial.chunkSize) {
        partial.chunkSize += size
      } else {
        partial.chunkSize = size
      }
    }
    notify()
  }
  function start(uuid: string, task: Task) {
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

  function flush(): TaskBatchUpdatePayloads {
    const result: TaskBatchUpdatePayloads = {
      adds,
      updates: Object.values(updates),
    }

    adds = []
    updates = {}

    return result
  }
  function destroy() {
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
function createTaskPusher(
  logger: Logger,
  emitter: TaskEventEmitter,
  interval: number,
  threshold: number,
  consume: (payload: TaskBatchUpdatePayloads) => void,
) {
  const monitor = createTaskMonitor(emitter, (size) => {
    if (size > threshold) {
      const all = monitor.flush()
      if (all.adds.length > 0) {
        const ids = new Set()
        for (const t of all.adds) {
          ids.add(t.uuid)
        }
      }
      consume(all)
    }
  })
  const flush = () => {
    const result = monitor.flush()
    if (result.adds.length) {
      const ids = new Set<string>()
      for (const t of result.adds) {
        ids.add(t.uuid)
      }
    }
    if (result.adds.length > 0 || result.updates.length > 0) {
      consume(result)
    }
  }
  const handle = setInterval(flush, interval)
  return () => {
    logger.log('Destroy task pusher')
    monitor.destroy()
    clearInterval(handle)
  }
}

export const pluginTasks: LauncherAppPlugin = (app) => {
  const emitter: TaskEventEmitter = new EventEmitter()
  const logger = app.getLogger('TaskManager')

  const pushers: Map<Client, () => void> = new Map()

  /**
   * All root tasks
   */
  const tasks: Task<any>[] = []

  /**
   * The dictionary for all root tasks
   */
  const record: Record<string, Task> = {}

  app.controller.handle('task-subscribe', (event) => {
    if (pushers.has(event.sender)) {
      pushers.get(event.sender)!()
    }
    const pusher = createTaskPusher(logger, emitter, 500, 30, (payload) => {
      if (event.sender.isDestroyed()) {
        pusher()
        pushers.delete(event.sender)
      } else {
        event.sender.send('task-update', payload)
      }
    })
    pushers.set(event.sender, pusher)
    return Object.entries(record).map(([uuid, task]) => mapTaskToTaskPayload(uuid, task))
  })
  app.controller.handle('task-unsubscribe', (event) => {
    const pusher = pushers.get(event.sender)
    if (pusher) { pusher() }
    pushers.delete(event.sender)
  })
  app.controller.handle('task-operation', (event, { type, id }) => {
    if (!record[id]) {
      logger.warn(`Cannot ${type} a unknown task id ${id}`)
      return
    }
    switch (type) {
      case 'pause':
        logger.log(`Request ${id} to pause`)
        record[id].pause()
        break
      case 'resume':
        logger.log(`Request ${id} to resume`)
        record[id].resume()
        break
      case 'cancel':
        logger.log(`Request ${id} to cancel`)
        record[id].cancel(5000)
        break
      default:
    }
  })

  const createTaskListener = (uid: string): TaskContext => {
    const context = {
      uuid: uid,
      onStart(task: Task<any>) {
        emitter.emit('start', uid, task)
      },
      onUpdate(task: Task<any>, chunkSize: number) {
        emitter.emit('update', uid, task, chunkSize)
      },
      async onFailed(task: Task<any>, error: any) {
        if (error instanceof CancelledError) {
          emitter.emit('cancel', uid, task)
        } else {
          const exception = await getNormalizeException(error)
          const serializedError = await getSerializedError(exception || error, {
            task: task.name,
          })
          emitter.emit('fail', uid, task, serializedError)
          Reflect.set(task, 'error', serializedError)

          logger.warn(`Task ${task.path} (${Object.getPrototypeOf(task).constructor.name}) ${task.name}(${uid}) failed!`)
          if (exception) {
            logger.warn(exception)
          } else {
            logger.error(error)
          }
        }
      },
      onSucceed(task: Task<any>, result: any) {
        emitter.emit('success', uid, task)
      },
      onPaused(task: Task<any>) {
        emitter.emit('pause', uid, task)
      },
      onResumed(task: Task<any>) {
        emitter.emit('resume', uid, task)
      },
      onCancelled(task: Task<any>) {
        emitter.emit('cancel', uid, task)
      },
    }
    return context
  }

  /**
   * Submit a task to run
   */
  const submit = async <T>(task: Task<T>): Promise<T> => {
    const uid = randomUUID()
    const listener = createTaskListener(uid)
    record[uid] = task
    task.start(listener)
    const index = tasks.length
    tasks.push(task)
    try {
      return await task.wait()
    } finally {
      logger.log('Task done and delete record!')
      delete record[uid]
      tasks.splice(index, 1)
    }
  }

  const getActiveTask = (): Task<any> | undefined => {
    return tasks[tasks.length - 1]
  }

  app.registry.register(kTaskExecutor, submit)
  app.registry.register(kTasks, {
    emitter,
    submit,
    getActiveTask,
  })
}
