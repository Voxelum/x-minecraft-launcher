import { TaskState, type Tasks } from '@xmcl/runtime-api'
import { onScopeDispose, shallowRef, watch, type Ref } from 'vue'

export function useTaskCompletion(tasks: Ref<Tasks[]>) {
  const justFinishedTask = shallowRef<Tasks | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    clearTimeout(timer)
    timer = undefined
    justFinishedTask.value = null
  }

  watch(() => tasks.value.filter(task => task.state === TaskState.Running).map(task => task.id), (running, previous) => {
    if (running.length) {
      clear()
    } else if (previous.length) {
      clear()
      const finished = previous.map(id => tasks.value.find(task => task.id === id))
      if (finished.every(task => task?.state === TaskState.Succeed)) {
        justFinishedTask.value = finished[0]!
        timer = setTimeout(clear, 3000)
      }
    }
  })
  onScopeDispose(clear)
  return { justFinishedTask }
}
