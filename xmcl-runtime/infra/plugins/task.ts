import { Task, TaskState } from '@xmcl/runtime-api'
import { SpanStatusCode } from '@opentelemetry/api'
import { randomUUID } from 'crypto'
import { LauncherAppPlugin } from '~/app'
import { startRuntimeInternalSpan } from '../telemetry_context'
import { TaskInstance, kTasks } from '../task'

export const pluginTasks: LauncherAppPlugin = (app) => {
  const logger = app.getLogger('TaskManager')
  /**
   * The dictionary for all root tasks
   */
  const active: TaskInstance<Task>[] = []
  let hasTaskRunning = false

  app.controller.handle('task-clear', (event) => {
    // remove finished
    for (let i = active.length - 1; i >= 0; i--) {
      if (
        active[i].state === TaskState.Succeed ||
        active[i].state === TaskState.Failed ||
        active[i].state === TaskState.Cancelled
      ) {
        active.splice(i, 1)
      }
    }
  })
  app.controller.handle('task-check', (event) => {
    return hasTaskRunning
  })
  app.controller.handle('task-poll', (event) => {
    return Object.values(active).map((t) => ({
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
    } satisfies Task))
  })
  app.controller.handle('task-operation', (event, { type, id }) => {
    const found = active.find((t) => t.id === id)
    if (!found) {
      logger.warn(`Cannot ${type} a unknown task id ${id}`)
      return
    }
    switch (type) {
      case 'cancel':
        logger.log(`Request ${id} to cancel`)
        found.controller.abort()
        break
      default:
    }
  })

  const getActiveTask = (): Task | undefined => {
    return Object.values(active).filter((v) => v.state === TaskState.Running)[0]
  }

  function checkTaskCompleted() {
    const hasRunning = active.some((t) => t.state === TaskState.Running)
    if (hasRunning !== hasTaskRunning) {
      hasTaskRunning = hasRunning
      app.controller.broadcast('task-activated', hasRunning)
    }
  }

  app.registry.register(kTasks, {
    getActiveTask,
    create: (task) => {
      const taskType = /^[a-zA-Z0-9_.-]{1,64}$/.test(task.type) ? task.type : 'unknown'
      const taskOperation =
        'operation' in task &&
        typeof task.operation === 'string' &&
        /^[a-zA-Z0-9_.-]{1,64}$/.test(task.operation)
          ? task.operation
          : undefined
      const taskSpan = startRuntimeInternalSpan('task.execute', {
        'task.type': taskType,
        'task.concurrent': active.filter((value) => value.state === TaskState.Running).length + 1,
        ...(taskOperation ? { 'task.operation': taskOperation } : {}),
      })
      let taskSpanEnded = false
      const obj = {
        ...task,
        id: randomUUID(),
        progress: 0,
        substate: {},
        state: TaskState.Running,
        error: undefined,
      } as TaskInstance<any>
      const controller = new AbortController()
      const endTaskSpan = (
        outcome: 'success' | 'error' | 'cancelled',
        error?: unknown,
      ) => {
        if (taskSpanEnded) return
        taskSpanEnded = true
        taskSpan?.setAttribute('task.outcome', outcome)
        if (obj.progress && typeof obj.progress === 'object') {
          if (typeof obj.progress.progress === 'number') {
            taskSpan?.setAttribute('task.progress.current', obj.progress.progress)
          }
          if (typeof obj.progress.total === 'number') {
            taskSpan?.setAttribute('task.progress.total', obj.progress.total)
          }
        }
        if (outcome === 'error') {
          taskSpan?.setStatus({ code: SpanStatusCode.ERROR })
          taskSpan?.setAttribute(
            'error.type',
            error instanceof Error ? error.name : typeof error,
          )
        }
        taskSpan?.end()
      }
      controller.signal.addEventListener('abort', () => {
        obj.state = TaskState.Cancelled
        endTaskSpan('cancelled')
        checkTaskCompleted()
      })
      const onComplete = () => {
        obj.state = TaskState.Succeed
        endTaskSpan('success')
        checkTaskCompleted()
      }
      const onFail = (error: unknown) => {
        if (obj.state === TaskState.Cancelled) {
          return
        }
        obj.state = TaskState.Failed
        obj.error = error as any
        endTaskSpan('error', error)
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
        app.controller.broadcast('task-activated', true)
      }
      hasTaskRunning = true
      active.unshift(obj)
      return obj
    },
  })
}
