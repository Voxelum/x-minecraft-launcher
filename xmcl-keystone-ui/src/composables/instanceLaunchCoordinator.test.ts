import type { LaunchService } from '@xmcl/runtime-api'
import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { RendererCommandHost } from './commandHost'
import { useInstanceLaunchCoordinator } from './instanceLaunchCoordinator'

function createHarness() {
  const listeners = new Map<string, Set<(event: any) => void>>()
  const launchService = {
    getGameProcesses: vi.fn().mockResolvedValue([]),
    on: vi.fn((event: string, listener: (event: any) => void) => {
      const eventListeners = listeners.get(event) ?? new Set()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
    }),
    removeListener: vi.fn((event: string, listener: (event: any) => void) => {
      listeners.get(event)?.delete(listener)
    }),
  } as unknown as LaunchService
  const commandHost = {
    dispatch: vi.fn(),
  } as unknown as RendererCommandHost
  const scope = effectScope()
  const coordinator = scope.run(() => useInstanceLaunchCoordinator(commandHost, launchService))!
  const emit = (event: string, payload: any) => {
    for (const listener of listeners.get(event) ?? []) listener(payload)
  }

  return { coordinator, emit, scope }
}

describe('instance launch coordinator', () => {
  it('deduplicates launch operations by instance path', async () => {
    const { coordinator, scope } = createHarness()
    let finish!: () => void
    const runner = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))

    const first = coordinator.launch('instance-a', runner)
    const second = coordinator.launch('instance-a', runner)

    expect(second).toBe(first)
    expect(runner).toHaveBeenCalledOnce()
    expect(coordinator.isLaunching('instance-a')).toBe(true)

    finish()
    await first

    expect(coordinator.isLaunching('instance-a')).toBe(false)
    scope.stop()
  })

  it('tracks running processes by instance path', () => {
    const { coordinator, emit, scope } = createHarness()

    emit('minecraft-start', { pid: 1, gameDirectory: 'instance-a' })
    emit('minecraft-start', { pid: 2, gameDirectory: 'instance-a' })
    expect(coordinator.isRunning('instance-a')).toBe(true)

    emit('minecraft-exit', { pid: 1 })
    expect(coordinator.isRunning('instance-a')).toBe(true)

    emit('minecraft-exit', { pid: 2 })
    expect(coordinator.isRunning('instance-a')).toBe(false)
    scope.stop()
  })
})