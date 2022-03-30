import { computed, Ref } from '@vue/composition-api'
import { TaskState } from '@xmcl/runtime-api'
import { injection } from '/@/util/inject'
import { getServiceCallTasks } from '../../../vuexServiceProxy'
import { TASK_MANAGER } from '../provideTaskProxy'

export function useTaskCount() {
  const proxy = injection(TASK_MANAGER)
  const { tasks } = proxy
  const count = computed(() => tasks.value.filter(t => t.state === TaskState.Running).length)
  return { count }
}

export function useTasks() {
  const proxy = injection(TASK_MANAGER)
  const { pause, resume, cancel, tasks } = proxy
  return { tasks, pause, resume, cancel }
}

export function useTaskFromServiceCall(call: Ref<Readonly<Promise<any> | undefined>>) {
  const proxy = injection(TASK_MANAGER)

  const { tasks } = proxy

  const task = computed(() => tasks.value.find(() => (call.value ? getServiceCallTasks(call.value)?.value[0] : undefined)))
  const name = computed(() => task.value?.title ?? '')
  const time = computed(() => task.value?.time ?? '')
  const status = computed(() => task.value?.state ?? TaskState.Running)
  const progress = computed(() => task.value?.progress ?? -1)
  const total = computed(() => task.value?.total ?? -1)
  const message = computed(() => task.value?.message ?? '')

  function wait() {
    // return dispatch('waitTask', taskHandle);
  }
  return {
    name,
    time,
    progress,
    total,
    message,
    status,
    wait,
  }
}
