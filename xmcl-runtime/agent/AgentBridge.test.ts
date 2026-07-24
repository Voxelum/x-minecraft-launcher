import { EventEmitter } from 'events'
import { describe, expect, test, vi } from 'vitest'
import type { Client } from '~/app'
import { AgentBridge } from './AgentBridge'

class FakeClient extends EventEmitter implements Client {
  destroyed = false
  send = vi.fn()
  isDestroyed() {
    return this.destroyed
  }
}

describe('AgentBridge', () => {
  test('routes provider events to the registered renderer', () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1' })

    expect(bridge.sendProviderEvent('b1', {
      bridgeId: 'b1',
      requestId: 'r1',
      type: 'event',
      event: { type: 'start' },
    })).toBe(true)
    expect(client.send).toHaveBeenCalledWith('agent-provider-event', expect.objectContaining({ requestId: 'r1' }))
  })

  test('drops provider events when the renderer disconnects', () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1' })
    client.emit('destroyed')
    expect(bridge.has('b1')).toBe(false)
  })

  test('uses one destroyed listener for multiple bridges on the same renderer', () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1' })
    bridge.register(client, { bridgeId: 'b2' })
    expect(client.listenerCount('destroyed')).toBe(1)
    bridge.unregister('b1')
    expect(client.listenerCount('destroyed')).toBe(1)
    bridge.unregister('b2')
    expect(client.listenerCount('destroyed')).toBe(0)
  })
})
