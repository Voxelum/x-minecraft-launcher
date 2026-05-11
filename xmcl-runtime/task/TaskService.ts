import { Task, Tasks as TaskUnion, TaskService as ITaskService, TaskServiceKey } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { LauncherApp } from '~/app/LauncherApp'
import { Tasks, kTasks } from '~/infra'
import { AbstractService, ExposeServiceKey } from '~/service'

@ExposeServiceKey(TaskServiceKey)
export class TaskService extends AbstractService implements ITaskService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(app)
    tasks.on('activated', this.#onActivated)
  }

  #onActivated = (active: boolean) => {
    this.emit('task-activated', active)
  }

  async getTasks(): Promise<TaskUnion[]> {
    return this.tasks.getAll().map((t) => ({
      ...t,
      progress: t.progress
        ? 'url' in t.progress
          ? {
              url: t.progress.url,
              total: t.progress.total,
              acceptRanges: t.progress.acceptRanges,
              progress: t.progress.progress,
              speed: t.progress.speed,
            }
          : {
              total: t.progress.total,
              progress: t.progress.progress,
            }
        : undefined,
    } satisfies Task)) as TaskUnion[]
  }

  async cancel(taskId: string): Promise<void> {
    const found = this.tasks.getAll().find((t) => t.id === taskId)
    if (!found) {
      this.warn(`Cannot cancel an unknown task id ${taskId}`)
      return
    }
    this.log(`Request ${taskId} to cancel`)
    found.controller.abort()
  }

  async clear(): Promise<void> {
    this.tasks.clear()
  }
}
