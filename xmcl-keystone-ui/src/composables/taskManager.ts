import { useInterval } from '@vueuse/core'
import { Tasks, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, onMounted, Ref, ref } from 'vue'

export type TaskItem = Tasks

export const kTaskManager: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

/**
 * Create a task manager based on vue reactivity
 */
export function useTaskManager() {
  const tasks: Ref<Tasks[]> = shallowRef([])

  const cancel = (task: Tasks) => {
    taskMonitor.cancel(task.id)
  }

  const poll = async () => {
    try {
      const ts = await taskMonitor.poll()
      tasks.value = ts
    } catch {
      // ignore
    }
  }

  const { counter, reset, pause, resume } = useInterval(250, {
    controls: true,
    immediate: false,
  })

  onMounted(() => {
    taskMonitor.on('task-activated', (v) => {
      poll()
      if (v) {
        resume()
      } else {
        pause()
        reset()
        setTimeout(poll, 100)
        setTimeout(poll, 300)
      }
    })
    taskMonitor.check().then((active) => {
      poll()
      if (active) {
        resume()
      }
    })
  })

  watch(counter, () => {
    poll()
  })

  function clear() {
    const active = tasks.value
    tasks.value = active.filter((t) => {
      return !(
        t.state === TaskState.Succeed ||
        t.state === TaskState.Failed ||
        t.state === TaskState.Cancelled
      )
    })
    taskMonitor.clear()
  }

  return {
    clear,
    tasks,
    cancel,
    poll,
  }
}
