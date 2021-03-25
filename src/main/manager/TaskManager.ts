import LauncherApp from '/@main/app/LauncherApp'
import { Client } from '/@main/engineBridge'
import { TaskEventEmitter, createTaskPusher, mapTaskToTaskPayload } from '/@main/entities/task'
import { CancelledError, task, Task, TaskContext, TaskLooped, TaskState } from '@xmcl/task'
import { EventEmitter } from 'events'
import { v4 } from 'uuid'
import { Manager } from '.'

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
      onSuccessed(task: Task<any>, result: any) {
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
  submit<T >(task: Task<T>): Promise<T> {
    const uid = v4()
    const listener = this.createTaskListener(uid)
    this.record[uid] = task
    task.start(listener)
    const index = this.tasks.length
    this.tasks.push(task)
    return task.wait().finally(() => {
      delete this.record[uid]
      this.tasks.splice(index, 1)
    })
  }

  getActiveTask(): Task<any> | undefined {
    return this.tasks[this.tasks.length - 1]
  }

  storeReady() {
    class SampleTask extends TaskLooped<void> {
      private handle!: NodeJS.Timeout

      constructor(total: number) {
        super()
        this._total = total
      }

      protected process(): Promise<[boolean, void | undefined ]> {
        return new Promise((resolve, reject) => {
          this.handle = setInterval(() => {
            if (this.isRunning) {
              this._progress += 1
              if (this._progress >= this._total) {
                this._progress = 0
              }
              this.update(1)
            } else {
              clearInterval(this.handle)
              if (this.state === TaskState.Paused) {
                resolve([false, undefined])
              } else {
                reject(new CancelledError(undefined))
              }
            }
          }, 1000)
        })
      }

      protected async validate(): Promise<void> {
      }

      protected shouldTolerant(e: any): boolean {
        return false
      }

      protected async abort(isCancelled: boolean): Promise<void> {
      }

      protected reset(): void {
      }
    }
    // this.submit(task('a', async function () {
    //     const first = (new SampleTask(10).setName('test1'));
    //     const sec = (new SampleTask(10).setName('test2'));
    //     const failed = (task('failed', async () => {
    //         await new Promise((resolve) => setTimeout(resolve, 5000));
    //         throw new Error('wtf');
    //     }));
    //     await this.all([first, sec, failed], {
    //         throwErrorImmediately: true,
    //         getErrorMessage() { return 'failed~' },
    //     });
    // }));
    // this.submit(Task.create('test', (c) => {
    //     c.execute(Task.create('a', (ctx) => {
    //         let progress = 0;
    //         let paused = false;
    //         ctx.pausealbe(() => {
    //             paused = true;
    //         }, () => {
    //             paused = false;
    //         });
    //         setInterval(() => {
    //             if (!paused) {
    //                 ctx.update(progress, 100, progress.toString());
    //                 progress += 10;
    //                 progress = progress > 100 ? 0 : progress;
    //             }
    //         }, 2000);
    //         return new Promise(() => { });
    //     }), 100);
    //     c.execute(Task.create('b', (ctx) => {
    //         let progress = 0;
    //         let paused = false;
    //         ctx.pausealbe(() => {
    //             paused = true;
    //         }, () => {
    //             paused = false;
    //         });
    //         setInterval(() => {
    //             if (!paused) {
    //                 ctx.update(progress, 100, progress.toString());
    //                 progress += 10;
    //                 progress = progress > 100 ? 0 : progress;
    //             }
    //         }, 2000);
    //         return new Promise(() => { });
    //     }));
    //     return new Promise(() => { });
    // }));
  }

  // SETUP CODE
  setup() {
    this.app.handle('task-subscribe', (event) => {
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
