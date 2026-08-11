import type { InstallInstanceTask, Tasks } from '@xmcl/runtime-api'
import { TaskState } from '@xmcl/runtime-api'
import type { Ref } from 'vue'
import { useTask } from './task'

export function useInstanceInstallOperation(path: Ref<string>, onSucceed: () => void) {
  const id = ref('')
  const instancePath = ref(path.value)

  function begin(targetPath = path.value) {
    id.value = crypto.getRandomValues(new Uint8Array(8)).join('')
    instancePath.value = targetPath
    return id.value
  }

  function reset() {
    id.value = ''
    instancePath.value = path.value
  }

  function isCurrentTask(task: Tasks): task is InstallInstanceTask {
    return task.type === 'installInstance' && task.taskId === id.value && task.instancePath === instancePath.value
  }

  const { task } = useTask(isCurrentTask)
  watch(task, (current, previous) => {
    if (previous && isCurrentTask(previous) && !current && previous.state === TaskState.Succeed) {
      onSucceed()
    }
  })

  return { id: readonly(id), task, begin, reset }
}