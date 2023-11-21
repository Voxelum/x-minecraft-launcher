import { CancelledError, Task, TaskContext } from '@xmcl/task'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { Client, LauncherAppPlugin } from '~/app'
import { serializeError } from '../util/error'
import { TaskEventEmitter, createTaskPusher, kTaskExecutor, kTasks, mapTaskToTaskPayload } from './task'

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
          const e = await serializeError(error)
          emitter.emit('fail', uid, task, e)
          Reflect.set(task, 'error', e)

          logger.warn(`Task ${task.path} (${Object.getPrototypeOf(task).constructor.name}) ${task.name}(${uid}) failed!`)
          if (error instanceof Array) {
            for (const e of error) {
              logger.warn(e)
            }
          } else {
            logger.warn(error)
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
