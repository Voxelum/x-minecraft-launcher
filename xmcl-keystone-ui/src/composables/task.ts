import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'
import { computed } from 'vue'
import { kTaskManager } from './taskManager'

export function useTaskCount() {
  const proxy = injection(kTaskManager)
  const { tasks } = proxy
  const count = computed(() => tasks.value.filter(t => t.state === TaskState.Running).length)
  return { count }
}

export function useTasks() {
  const proxy = injection(kTaskManager)
  const { pause, resume, cancel, tasks, throughput } = proxy
  return { tasks, pause, resume, cancel, throughput }
}

export function useTaskName() {
  const { t, tm, te } = useI18n()
  const tTask = (id: string, param: Record<string, any>) => {
    const result = tm(id)
    if (typeof result === 'function') {
      return t(id, param)
    }
    return te(id + '.name', 'en') ? t(id + '.name', param) : id
  }
  return tTask
}

export function useTask(finder: (i: TaskItem) => boolean) {
  const proxy = injection(kTaskManager)

  const { tasks, pause, resume, cancel } = proxy

  const tTask = useTaskName()
  const name = computed(() => task.value ? tTask(task.value.path, task.value.param) : '')
  const task = computed(() => tasks.value.find((i) => i.state === TaskState.Running && finder(i)))
  const time = computed(() => task.value?.time ?? '')
  const status = computed(() => task.value?.state ?? TaskState.Idle)
  const progress = computed(() => task.value?.progress ?? -1)
  const total = computed(() => task.value?.total ?? -1)
  const message = computed(() => task.value?.message ?? '')

  const pause_ = () => task.value ? pause(task.value) : undefined
  const resume_ = () => task.value ? resume(task.value) : undefined

  return {
    name,
    time,
    task,
    pause: pause_,
    resume: resume_,
    progress,
    total,
    message,
    status,
  }
}
