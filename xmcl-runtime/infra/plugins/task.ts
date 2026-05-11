import { Task, TaskState } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import { LauncherAppPlugin } from '~/app'
import { TaskInstance, Tasks, kTasks } from '../task'

export const pluginTasks: LauncherAppPlugin = (app) => {
  /**
   * The dictionary for all root tasks
   */
  const active: TaskInstance<Task>[] = []
  const emitter = new EventEmitter()
  let hasTaskRunning = false

  const getActiveTask = (): Task | undefined => {
    return active.find((v) => v.state === TaskState.Running)
  }

  function checkTaskCompleted() {
    const hasRunning = active.some((t) => t.state === TaskState.Running)
    if (hasRunning !== hasTaskRunning) {
      hasTaskRunning = hasRunning
      emitter.emit('activated', hasRunning)
    }
  }

  const tasks: Tasks = {
    getActiveTask,
    getAll: () => active,
    clear: () => {
      for (let i = active.length - 1; i >= 0; i--) {
        if (
          active[i].state === TaskState.Succeed ||
          active[i].state === TaskState.Failed ||
          active[i].state === TaskState.Cancelled
        ) {
          active.splice(i, 1)
        }
      }
    },
    on: (event, listener) => {
      emitter.on(event, listener)
      return tasks
    },
    off: (event, listener) => {
      emitter.off(event, listener)
      return tasks
    },
    create: (task) => {
      const obj = {
        ...task,
        id: randomUUID(),
        progress: 0,
        substate: {},
        state: TaskState.Running,
        error: undefined,
      } as TaskInstance<any>
      const controller = new AbortController()
      controller.signal.addEventListener('abort', () => {
        obj.state = TaskState.Cancelled
        checkTaskCompleted()
      })
      const onComplete = () => {
        obj.state = TaskState.Succeed
        checkTaskCompleted()
      }
      const onFail = (error: unknown) => {
        if (obj.state === TaskState.Cancelled) {
          return
        }
        obj.state = TaskState.Failed
        obj.error = error as any
        checkTaskCompleted()
      }
      Object.defineProperties(obj, {
        controller: {
          value: controller,
          enumerable: false,
          writable: false,
        },
        complete: {
          value: onComplete,
          enumerable: false,
          writable: false,
        },
        fail: {
          value: onFail,
          enumerable: false,
          writable: false,
        },
        wrap: {
          value: (p: Promise<any>) => {
            return p.then(
              (v) => {
                onComplete()
                return v
              },
              (e) => {
                onFail(e)
                throw e
              },
            )
          },
          enumerable: false,
          writable: false,
        },
      })
      if (!hasTaskRunning) {
        hasTaskRunning = true
        emitter.emit('activated', true)
      }
      active.unshift(obj)
      return obj
    },
  }

  app.registry.register(kTasks, tasks)
}
