import { EventEmitter } from 'events'
import { describe, expect, test, vi } from 'vitest'
import { Client } from '~/app'
import { ServiceStateContainer } from './ServiceStateContainer'

class TestState {
  value = 0

  valueSet(value: number) {
    this.value = value
  }
}

function createClient() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
  }) as Client & EventEmitter
}

describe(ServiceStateContainer, () => {
  test('removes the client destroyed listener when the state is untracked', async () => {
    const client = createClient()
    const disposer = vi.fn()
    const unregister = vi.fn()
    const container = new ServiceStateContainer('test', unregister, {
      factory: async () => [new TestState(), disposer],
    })
    await container.promise

    container.track(client)
    expect(client.listenerCount('destroyed')).toBe(1)

    expect(container.untrack(client)).toBe(true)
    expect(client.listenerCount('destroyed')).toBe(0)
    expect(disposer).toHaveBeenCalledOnce()
    expect(unregister).toHaveBeenCalledWith('test')
  })

  test('removes tracked client listeners when destroyed directly', async () => {
    const client = createClient()
    const disposer = vi.fn()
    const unregister = vi.fn()
    const container = new ServiceStateContainer('test', unregister, {
      factory: async () => [new TestState(), disposer],
    })
    await container.promise
    container.track(client)

    container.destroy()
    container.destroy()

    expect(client.listenerCount('destroyed')).toBe(0)
    expect(disposer).toHaveBeenCalledOnce()
    expect(unregister).toHaveBeenCalledOnce()
  })

  test('shares one destroyed listener between containers for the same client', async () => {
    const client = createClient()
    const firstDisposer = vi.fn()
    const secondDisposer = vi.fn()
    const first = new ServiceStateContainer('first', vi.fn(), {
      factory: async () => [new TestState(), firstDisposer],
    })
    const second = new ServiceStateContainer('second', vi.fn(), {
      factory: async () => [new TestState(), secondDisposer],
    })
    await Promise.all([first.promise, second.promise])

    first.track(client)
    second.track(client)
    expect(client.listenerCount('destroyed')).toBe(1)

    client.emit('destroyed')

    expect(client.listenerCount('destroyed')).toBe(0)
    expect(firstDisposer).toHaveBeenCalledOnce()
    expect(secondDisposer).toHaveBeenCalledOnce()
  })
})