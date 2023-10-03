import { CancelledError, Task, TaskContext, TaskState } from '@xmcl/task'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { Manager } from '.'
import { LauncherApp } from '../app/LauncherApp'
import { Client } from '../engineBridge'
import { createTaskPusher, mapTaskToTaskPayload, TaskEventEmitter } from '../entities/task'
import { serializeError } from '../util/error'

export default class TaskManager extends Manager {
  readonly emitter: TaskEventEmitter = new EventEmitter()
  private logger = this.app.getLogger('TaskManager')

  private pushers: Map<Client, () => void> = new Map()

  /**
   * All root tasks
   */
  private tasks: Task<any>[] = []

  /**
   * The dictionary for all root tasks
   */
  readonly record: Record<string, Task> = {}

  constructor(app: LauncherApp) {
    super(app)
    app.controller.handle('task-subscribe', (event) => {
      if (this.pushers.has(event.sender)) {
        this.pushers.get(event.sender)!()
      }
      const pusher = createTaskPusher(this.logger, this.emitter, 500, 30, (payload) => {
        if (event.sender.isDestroyed()) {
          pusher()
          this.pushers.delete(event.sender)
        } else {
          event.sender.send('task-update', payload)
        }
      })
      this.pushers.set(event.sender, pusher)
      return Object.entries(this.record).map(([uuid, task]) => mapTaskToTaskPayload(uuid, task))
    })
    app.controller.handle('task-unsubscribe', (event) => {
      const pusher = this.pushers.get(event.sender)
      if (pusher) { pusher() }
      this.pushers.delete(event.sender)
    })
    app.controller.handle('task-operation', (event, { type, id }) => {
      if (!this.record[id]) {
        this.logger.warn(`Cannot ${type} a unknown task id ${id}`)
        return
      }
      switch (type) {
        case 'pause':
          this.logger.log(`Request ${id} to pause`)
          this.record[id].pause()
          break
        case 'resume':
          this.logger.log(`Request ${id} to resume`)
          this.record[id].resume()
          break
        case 'cancel':
          this.logger.log(`Request ${id} to cancel`)
          this.record[id].cancel(5000)
          break
        default:
      }
    })
  }

  private createTaskListener(uid: string): TaskContext {
    const emitter = this.emitter
    const logger = this.logger
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
  async submit<T>(task: Task<T>): Promise<T> {
    const uid = randomUUID()
    const listener = this.createTaskListener(uid)
    this.record[uid] = task
    task.start(listener)
    const index = this.tasks.length
    this.tasks.push(task)
    try {
      return await task.wait()
    } finally {
      this.logger.log('Task done and delete record!')
      delete this.record[uid]
      this.tasks.splice(index, 1)
    }
  }

  getActiveTask(): Task<any> | undefined {
    return this.tasks[this.tasks.length - 1]
  }
}
