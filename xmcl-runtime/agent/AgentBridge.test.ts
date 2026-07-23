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
  test('routes a tool call to one renderer and resolves it', async () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1', agentId: 'launcher' })

    const resultPromise = bridge.executeUi('b1', 'r1', { action: 'navigate', path: '/' }, 5_000)
    const request = client.send.mock.calls[0][1]
    bridge.resolve({ bridgeId: 'b1', callId: request.callId, result: { ok: true } })

    await expect(resultPromise).resolves.toEqual({ ok: true })
  })

  test('rejects pending calls when the renderer disconnects', async () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1', agentId: 'launcher' })
    const resultPromise = bridge.executeUi('b1', 'r1', { action: 'navigate', path: '/' }, 5_000)
    client.emit('destroyed')
    await expect(resultPromise).rejects.toThrow('disconnected')
  })

  test('uses one destroyed listener for multiple bridges on the same renderer', () => {
    const bridge = new AgentBridge()
    const client = new FakeClient()
    bridge.register(client, { bridgeId: 'b1', agentId: 'launcher' })
    bridge.register(client, { bridgeId: 'b2', agentId: 'css' })
    expect(client.listenerCount('destroyed')).toBe(1)
    bridge.unregister('b1')
    expect(client.listenerCount('destroyed')).toBe(1)
    bridge.unregister('b2')
    expect(client.listenerCount('destroyed')).toBe(0)
  })
})
