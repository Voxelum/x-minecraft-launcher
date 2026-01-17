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

  const { counter, reset, pause, resume } = useInterval(1000, {
    controls: true,
    immediate: false,
  })

  onMounted(() => {
    taskMonitor.on('task-activated', (v) => {
      if (v) {
        resume()
      } else {
        pause()
        reset()
      }
    })
    taskMonitor.check().then((active) => {
      if (active) {
        resume()
      }
    })
  })

  watch(counter, () => {
    taskMonitor.poll().then((ts) => {
      tasks.value = ts
    })
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
  }
}
