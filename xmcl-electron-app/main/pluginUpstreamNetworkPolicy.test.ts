import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => {
  const createSession = () => {
    let listener: (details: { url: string }, callback: (result: { cancel: boolean }) => void) => void
    return {
      webRequest: { onBeforeRequest: vi.fn((fn) => { listener = fn }) },
      isCancelled: (url: string) => {
        let cancelled = false
        listener?.({ url }, (result) => { cancelled = result.cancel })
        return cancelled
      },
    }
  }
  return { createSession, defaultSession: createSession() }
})
const app = new EventEmitter() as EventEmitter & { whenReady: () => Promise<void> }
app.whenReady = () => Promise.resolve()
vi.mock('electron', () => ({
  app,
  session: { defaultSession: electron.defaultSession },
}))

describe('Electron session isolation', () => {
  it('cancels upstream HTTP and WebSocket requests in default and future sessions', async () => {
    const { pluginUpstreamNetworkPolicy } = await import('./pluginUpstreamNetworkPolicy')
    pluginUpstreamNetworkPolicy({} as any, {} as any)
    await Promise.resolve()
    const partition = electron.createSession()
    app.emit('session-created', partition)
    for (const session of [electron.defaultSession, partition]) {
      expect(session.isCancelled('https://api.xmcl.app/latest')).toBe(true)
      expect(session.isCancelled('wss://signaling.xmcl.app/socket')).toBe(true)
      expect(session.isCancelled('http://localhost:3000/index.html')).toBe(false)
      expect(session.isCancelled('https://api.modrinth.com/v2/project')).toBe(false)
    }
  })
})
