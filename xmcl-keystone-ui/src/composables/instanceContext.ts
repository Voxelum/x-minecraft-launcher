import { InjectionKey } from 'vue'
import { useInstance, useInstanceVersion } from './instance'
import { useLaunchIssue } from './launchIssue'
import { useLaunchTask } from './launchTask'

export function useInstanceContext() {
  const issue = useLaunchIssue()
  const task = useLaunchTask()
  const { path, instance, refreshing } = useInstance()
  const name = computed(() => instance.value.name)
  const version = computed(() => instance.value.runtime)
  const { localVersion } = useInstanceVersion()

  return {
    issue,
    task,
    path,
    name,
    version,
    localVersion,
    instance,
    refreshing,
  }
}

export const kInstanceContext: InjectionKey<ReturnType<typeof useInstanceContext>> = Symbol('InstanceContext')
