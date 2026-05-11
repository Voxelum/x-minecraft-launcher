import { useInterval } from '@vueuse/core'
import { Tasks, TaskServiceKey, TaskState } from '@xmcl/runtime-api'
import { InjectionKey, onMounted, Ref, ref } from 'vue'

export type TaskItem = Tasks

export const kTaskManager: InjectionKey<ReturnType<typeof useTaskManager>> = Symbol('TASK_MANAGER')

/**
 * Create a task manager based on vue reactivity.
 *
 * Note: this composable is invoked from the root window's `setup()` to be
 * `provide`d. At that point `kServiceFactory` has been `provide`d but
 * `inject` does not see it (Vue 3 only walks ancestors, not the current
 * setup). So we open the service channel directly via the always-present
 * `serviceChannels` global instead of going through `useService`.
 */
export function useTaskManager() {
  const taskService = serviceChannels.open(TaskServiceKey)
  const tasks: Ref<Tasks[]> = shallowRef([])

  const cancel = (task: Tasks) => {
    taskService.call('cancel', task.id)
  }

  const { counter, reset, pause, resume } = useInterval(1000, {
    controls: true,
    immediate: false,
  })

  onMounted(async () => {
    taskService.on('task-activated', (v) => {
      if (v) {
        resume()
      } else {
        pause()
        reset()
      }
    })
    // Seed the initial snapshot. If anything is running, kick off the
    // poll loop; the `task-activated` event handles every later transition.
    const initial = await taskService.call('getTasks')
    tasks.value = initial
    if (initial.some((t) => t.state === TaskState.Running)) {
      resume()
    }
  })

  watch(counter, () => {
    taskService.call('getTasks').then((ts) => {
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
    taskService.call('clear')
  }

  return {
    clear,
    tasks,
    cancel,
  }
}
