import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { Client, LauncherApp } from '~/app'
import { ServiceStateManager } from './ServiceStateManager'

class TestState {
  value = 0

  valueSet(value: number) {
    this.value = value
  }
}

class TestClient extends EventEmitter implements Client {
  readonly send = vi.fn()
  private destroyed = false

  isDestroyed() {
    return this.destroyed
  }

  destroy() {
    this.destroyed = true
    this.emit('destroyed')
  }

  disconnectRenderer() {
    this.emit('renderer-disconnected')
  }
}

describe('ServiceStateManager', () => {
  it('uses one lifecycle listener pair for all states tracked by a client', () => {
    const app = {
      controller: { handle: vi.fn() },
      disposed: false,
      getLogger: vi.fn(() => ({ error: vi.fn() })),
      registryDisposer: vi.fn(),
    } as unknown as LauncherApp
    const manager = new ServiceStateManager(app)
    const client = new TestClient()
    const states = Array.from({ length: 12 }, (_, index) => {
      const state = new TestState()
      manager.registerStatic(state, `state-${index}`)
      manager.serializeAndTrack(client, state as any)
      return state
    })

    expect(client.listenerCount('destroyed')).toBe(1)
    expect(client.listenerCount('renderer-disconnected')).toBe(1)
    states[0].valueSet(1)
    expect(client.send).toHaveBeenCalledOnce()

    client.disconnectRenderer()
    states[0].valueSet(2)
    expect(client.send).toHaveBeenCalledOnce()
    expect(client.listenerCount('destroyed')).toBe(0)
    expect(client.listenerCount('renderer-disconnected')).toBe(0)

    manager.serializeAndTrack(client, states[0] as any)
    states[0].valueSet(3)
    expect(client.send).toHaveBeenCalledTimes(2)
    expect(client.listenerCount('destroyed')).toBe(1)
    expect(client.listenerCount('renderer-disconnected')).toBe(1)

    client.destroy()
    states[0].valueSet(4)
    expect(client.send).toHaveBeenCalledTimes(2)
    expect(client.listenerCount('destroyed')).toBe(0)
    expect(client.listenerCount('renderer-disconnected')).toBe(0)
  })
})