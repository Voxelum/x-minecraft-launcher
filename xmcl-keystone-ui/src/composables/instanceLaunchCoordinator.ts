import { LaunchServiceKey } from '@xmcl/runtime-api'
import type { LaunchService } from '@xmcl/runtime-api'
import { InjectionKey, onScopeDispose, shallowRef } from 'vue'
import { RendererCommandHost, useRendererCommandHost } from './commandHost'
import { useService } from './service'

export const kInstanceLaunchCoordinator: InjectionKey<ReturnType<typeof useInstanceLaunchCoordinator>> = Symbol('InstanceLaunchCoordinator')

export function useInstanceLaunchCoordinator(
  commandHost: RendererCommandHost = useRendererCommandHost(),
  launchService: LaunchService = useService(LaunchServiceKey),
) {
  const operations = new Map<string, Promise<unknown>>()
  const processInstances = new Map<number, string>()
  const exitedBeforeInitialization = new Set<number>()
  let initialized = false
  const launchingInstances = shallowRef<Record<string, boolean>>({})
  const runningInstances = shallowRef<Record<string, number>>({})

  function isLaunching(instancePath: string) {
    return launchingInstances.value[instancePath] === true
  }

  function isRunning(instancePath: string) {
    return (runningInstances.value[instancePath] ?? 0) > 0
  }

  function markRunning(instancePath: string, pid: number) {
    if (processInstances.has(pid)) return
    processInstances.set(pid, instancePath)
    runningInstances.value = {
      ...runningInstances.value,
      [instancePath]: (runningInstances.value[instancePath] ?? 0) + 1,
    }
  }

  function markStopped(pid: number) {
    const instancePath = processInstances.get(pid)
    if (!instancePath) return
    processInstances.delete(pid)
    const count = (runningInstances.value[instancePath] ?? 1) - 1
    const next = { ...runningInstances.value }
    if (count > 0) {
      next[instancePath] = count
    } else {
      delete next[instancePath]
    }
    runningInstances.value = next
  }

  const onMinecraftStart = ({ pid, gameDirectory }: { pid: number; gameDirectory: string }) => {
    exitedBeforeInitialization.delete(pid)
    markRunning(gameDirectory, pid)
  }
  const onMinecraftExit = ({ pid }: { pid: number }) => {
    if (!initialized && !processInstances.has(pid)) exitedBeforeInitialization.add(pid)
    markStopped(pid)
  }
  launchService.on('minecraft-start', onMinecraftStart)
  launchService.on('minecraft-exit', onMinecraftExit)
  void launchService.getGameProcesses().then((processes) => {
    for (const process of processes) {
      if (exitedBeforeInitialization.has(process.pid)) continue
      markRunning(process.options.gameDirectory, process.pid)
    }
  }).catch(console.error).finally(() => {
    initialized = true
    exitedBeforeInitialization.clear()
  })

  onScopeDispose(() => {
    launchService.removeListener('minecraft-start', onMinecraftStart)
    launchService.removeListener('minecraft-exit', onMinecraftExit)
  })

  function launch(instancePath: string, runner?: () => Promise<unknown>) {
    const existed = operations.get(instancePath)
    if (existed) return existed

    launchingInstances.value = { ...launchingInstances.value, [instancePath]: true }
    const operation = (runner ? runner() : commandHost.dispatch('instance.launch', { instance: instancePath }))
      .then((pid) => {
        if (typeof pid === 'number') markRunning(instancePath, pid)
        return pid
      })
      .finally(() => {
        if (operations.get(instancePath) === operation) {
          operations.delete(instancePath)
          const next = { ...launchingInstances.value }
          delete next[instancePath]
          launchingInstances.value = next
        }
      })
    operations.set(instancePath, operation)
    return operation
  }

  return {
    isLaunching,
    isRunning,
    launch,
    launchingInstances,
    runningInstances,
  }
}