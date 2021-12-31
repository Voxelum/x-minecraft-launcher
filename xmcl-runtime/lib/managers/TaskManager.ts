import { Task, TaskContext, TaskState } from '@xmcl/task'
import { EventEmitter } from 'events'
import { v4 } from 'uuid'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { Client } from '../engineBridge'
import { createTaskPusher, mapTaskToTaskPayload, TaskEventEmitter } from '../entities/task'

export default class TaskManager extends Manager {
  readonly emitter: TaskEventEmitter = new EventEmitter()

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
  }

  private createTaskListener(uid: string): TaskContext {
    const emitter = this.emitter
    const context = {
      uuid: uid,
      onStart(task: Task<any>) {
        emitter.emit('start', uid, task)
      },
      onUpdate(task: Task<any>, chunkSize: number) {
        emitter.emit('update', uid, task, chunkSize)
      },
      onFailed(task: Task<any>, error: any) {
        emitter.emit('fail', uid, task, error)
        let errorMessage: string
        if (error instanceof Error) {
          errorMessage = error.toString()
        } else {
          errorMessage = JSON.stringify(error, null, 4)
        }
        Reflect.set(task, 'error', errorMessage)
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

  getTaskUUID(task: Task<any>): string {
    if (task.state !== TaskState.Running) {
      throw new Error('The task must be running')
    }
    return (task.context as any).uuid as string
  }

  /**
   * Submit a task to run
   */
  submit<T>(task: Task<T>): Promise<T> {
    const uid = v4()
    const listener = this.createTaskListener(uid)
    this.record[uid] = task
    task.start(listener)
    const index = this.tasks.length
    this.tasks.push(task)
    return task.wait().finally(() => {
      this.log('Task done and delete record!')
      delete this.record[uid]
      this.tasks.splice(index, 1)
    })
  }

  getActiveTask(): Task<any> | undefined {
    return this.tasks[this.tasks.length - 1]
  }

  storeReady() {
    this.emitter.on('fail', (uuid, task, error) => {
      this.warn(`Task ${task.name}(${uuid}) failed!`)
      this.warn(error)
    })
  }

  // SETUP CODE
  setup() {
    this.app.handle('task-subscribe', (event) => {
      if (this.pushers.has(event.sender)) {
        this.pushers.get(event.sender)!()
      }
      const pusher = createTaskPusher(this.emitter, 500, 30, (payload) => {
        event.sender.send('task-update', payload)
      })
      this.pushers.set(event.sender, pusher)
      return Object.entries(this.record).map(([uuid, task]) => mapTaskToTaskPayload(uuid, task))
    })
    this.app.handle('task-unsubscribe', (event) => {
      const pusher = this.pushers.get(event.sender)
      if (pusher) { pusher() }
    })
    this.app.handle('task-operation', (event, { type, id }) => {
      if (!this.record[id]) {
        this.warn(`Cannot ${type} a unknown task id ${id}`)
        return
      }
      switch (type) {
        case 'pause':
          this.log(`Request ${id} to pause`)
          this.record[id].pause()
          break
        case 'resume':
          this.log(`Request ${id} to resume`)
          this.record[id].resume()
          break
        case 'cancel':
          this.log(`Request ${id} to cancel`)
          this.record[id].cancel()
          break
        default:
      }
    })
  }
}
