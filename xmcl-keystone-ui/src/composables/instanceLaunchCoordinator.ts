import { InjectionKey, shallowRef } from 'vue'
import { useRendererCommandHost } from './commandHost'

export const kInstanceLaunchCoordinator: InjectionKey<ReturnType<typeof useInstanceLaunchCoordinator>> = Symbol('InstanceLaunchCoordinator')

export function useInstanceLaunchCoordinator() {
  const commandHost = useRendererCommandHost()
  const operations = new Map<string, Promise<unknown>>()
  const launchingInstances = shallowRef<Record<string, boolean>>({})

  function isLaunching(instancePath: string) {
    return launchingInstances.value[instancePath] === true
  }

  function launch(instancePath: string) {
    const existed = operations.get(instancePath)
    if (existed) return existed

    launchingInstances.value = { ...launchingInstances.value, [instancePath]: true }
    const operation = commandHost.dispatch('instance.launch', { instance: instancePath }).finally(() => {
      if (operations.get(instancePath) === operation) {
        operations.delete(instancePath)
        launchingInstances.value = { ...launchingInstances.value, [instancePath]: false }
      }
    })
    operations.set(instancePath, operation)
    return operation
  }

  return {
    isLaunching,
    launch,
    launchingInstances,
  }
}